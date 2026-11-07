import { Duration, Effect, Schedule } from 'effect';
import { UnsupportedPage, type TabId } from '../domain';
import { Messenger } from '../messaging';
import { Scripting, Tabs, unsupportedUrl, type TabInfo } from '../platform';
import { SessionStore } from '../storage';
import { activationKey, missingKey, originOf } from './keys';
import type { ActivateVia } from '../messaging';

const PING_TIMEOUT_MS = 300;
const INJECT_RETRY_DELAY = Duration.millis(300);
const INJECT_RETRIES = 1;

const injectWithRetry = (tabId: TabId) =>
  Effect.gen(function* () {
    const messenger = yield* Messenger;
    const scripting = yield* Scripting;
    const ping = messenger.toContent(
      tabId,
      { _tag: 'Ping' },
      { timeoutMs: PING_TIMEOUT_MS, retries: 0 },
    );
    return yield* scripting.injectContent(tabId, ping);
  }).pipe(
    // retry ×1 after 300 ms, then escape (§6)
    Effect.retry(
      Schedule.spaced(INJECT_RETRY_DELAY).pipe(Schedule.intersect(Schedule.recurs(INJECT_RETRIES))),
    ),
  );

const readSupportedTab = (tabId: TabId) =>
  Effect.gen(function* () {
    const tab: TabInfo = yield* (yield* Tabs).get(tabId);
    if (unsupportedUrl(tab.url)) return yield* Effect.fail(new UnsupportedPage({ url: tab.url }));
    return tab;
  });

/**
 * F1: Tabs.get → unsupportedUrl → inject (ping first) → PickerStart → persist activation.
 * The panel path never requests host access here; the panel did it inside its own click handler.
 */
export const ensureActivation = (tabId: TabId, via: ActivateVia) =>
  Effect.gen(function* () {
    const tab = yield* readSupportedTab(tabId);
    yield* injectWithRetry(tabId);
    yield* (yield* Messenger).toContent(tabId, { _tag: 'PickerStart' });
    yield* (yield* SessionStore).set(activationKey(tabId), {
      tabId,
      origin: originOf(tab.url),
      active: true,
    });
  }).pipe(Effect.annotateLogs({ via }));

export const clearActivation = (tabId: TabId) =>
  Effect.flatMap(SessionStore, (store) => store.remove([activationKey(tabId)]));

/** Drops activation and missing report of a tab that navigated to another origin. */
export const clearIfOriginChanged = (tabId: TabId, url: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore;
    const stored = yield* store.get(activationKey(tabId));
    const origin =
      typeof stored === 'object' && stored !== null && 'origin' in stored
        ? stored.origin
        : undefined;
    if (origin === undefined || origin === originOf(url)) return;
    yield* store.remove([missingKey(tabId)]);
    yield* clearActivation(tabId);
  });

const storedActivation = (tabId: TabId) =>
  Effect.map(
    Effect.flatMap(SessionStore, (store) => store.get(activationKey(tabId))),
    (stored) =>
      typeof stored === 'object' &&
      stored !== null &&
      'active' in stored &&
      stored.active === true &&
      'origin' in stored &&
      typeof stored.origin === 'string'
        ? stored.origin
        : undefined,
  );

/**
 * F4: a same-origin reload or navigation drops the content script while `activation:<tab>` stays
 * active. When the tab finished loading, re-inject (ping first); no PickerStart, the panel owns that.
 */
export const reinjectIfActive = (tabId: TabId) =>
  Effect.gen(function* () {
    const origin = yield* storedActivation(tabId);
    if (origin === undefined) return;
    const tab = yield* readSupportedTab(tabId);
    if (originOf(tab.url) !== origin) return;
    yield* injectWithRetry(tabId);
  });
