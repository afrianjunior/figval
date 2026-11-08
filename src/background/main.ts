import { Effect, Layer, ManagedRuntime, Option, Schema, Stream } from 'effect';
import { TabId } from '../domain';
import { Messenger, MessengerLive } from '../messaging';
import { Action, Commands, Extension, PlatformLive, SidePanel, Tabs, primeEarlyEvents } from '../platform';
import { SessionRepo, SessionStore, SettingsRepo, StorageLive } from '../storage';
import {
  clearActivation,
  clearIfOriginChanged,
  ensureActivation,
  reinjectIfActive,
} from './activation';
import { missingKey } from './keys';
import { asHandler, type HandleEnv } from './router';
import { updateSettings } from './sessions';

export const BackgroundLive = Layer.mergeAll(StorageLive, PlatformLive, MessengerLive);

const PICK_COMMAND = 'pick';
/** Built from src/entrypoints/welcome. */
export const WELCOME_PAGE = '/welcome.html';

const logged = <E>(label: string) =>
  Effect.catchAll((e: E) => Effect.logWarning(`${label} failed`, e));

const onToolbarClick = Stream.flatMap(
  Action.pipe(
    Effect.map((a) => a.onClicked),
    Stream.unwrap,
  ),
  (tab) => Stream.fromEffect(ensureActivation(tab.id, 'action').pipe(logged('activation'))),
);

const onPickCommand = Stream.unwrap(Effect.map(Commands, (c) => c.onCommand)).pipe(
  Stream.filter((name) => name === PICK_COMMAND),
  Stream.mapEffect(() =>
    Effect.flatMap(Tabs, (tabs) => tabs.queryActive).pipe(
      Effect.flatMap((tab) =>
        tab._tag === 'Some' ? ensureActivation(tab.value.id, 'command') : Effect.void,
      ),
      logged('command'),
    ),
  ),
);

/**
 * Users from before onboarding decode the new flags as false. Having a session means they already
 * picked and noted, so skip the checklist and the first-note hint for them.
 */
const onboardExistingUser = Effect.gen(function* () {
  const { items } = yield* (yield* SessionRepo).list;
  if (items.length === 0) return;
  yield* updateSettings({ checklistDismissed: true, tooltipHintSeen: true });
});

/** A fresh install gets the welcome tab; an update only migrates; Chrome restarts stay quiet. */
const onInstall = Stream.unwrap(Effect.map(Extension, (e) => e.onInstalled)).pipe(
  Stream.mapEffect((reason): Effect.Effect<void, never, Extension | SessionRepo | SettingsRepo> => {
    if (reason === 'install') return Effect.flatMap(Extension, (e) => e.openPage(WELCOME_PAGE));
    return reason === 'update' ? onboardExistingUser.pipe(logged('onboarding migration')) : Effect.void;
  }),
);

const onTabRemoved = Stream.unwrap(Effect.map(Tabs, (t) => t.onRemoved)).pipe(
  Stream.mapEffect((tabId) =>
    Effect.flatMap(SessionStore, (s) => s.remove([missingKey(tabId)])).pipe(
      Effect.zipRight(clearActivation(tabId)),
      logged('cleanup'),
    ),
  ),
);

const decodeTabId = Schema.decodeUnknownOption(TabId);

type NavEvent =
  | { readonly kind: 'loading'; readonly tabId: TabId; readonly url: string }
  | { readonly kind: 'complete'; readonly tabId: TabId };

const navEventOf = (u: {
  readonly tabId: number;
  readonly status?: string | undefined;
  readonly url?: string | undefined;
}): Option.Option<NavEvent> => {
  const tabId = decodeTabId(u.tabId);
  if (u.status === 'loading' && u.url !== undefined) {
    const url = u.url;
    return Option.map(tabId, (id): NavEvent => ({ kind: 'loading', tabId: id, url }));
  }
  return u.status === 'complete'
    ? Option.map(tabId, (id): NavEvent => ({ kind: 'complete', tabId: id }))
    : Option.none();
};

/** `loading` with a url: a new origin ends the activation. `complete`: an active same-origin tab is re-injected. */
const onNavigation = Stream.unwrap(Effect.map(Tabs, (t) => t.onUpdated)).pipe(
  Stream.filterMap(navEventOf),
  Stream.mapEffect((event) =>
    (event.kind === 'loading'
      ? clearIfOriginChanged(event.tabId, event.url)
      : reinjectIfActive(event.tabId)
    ).pipe(logged('navigation')),
  ),
);

export const program = Effect.gen(function* () {
  const context = yield* Effect.context<HandleEnv>();
  yield* (yield* Messenger).serve('background', asHandler(context));
  yield* (yield* SessionStore).allowContentAccess.pipe(logged('content access'));
  // false, so Chrome fires action.onClicked: the click grants activeTab and injects the picker there.
  yield* (yield* SidePanel).setPanelBehavior(false);
  yield* Effect.all(
    [
      Stream.runDrain(onToolbarClick),
      Stream.runDrain(onPickCommand),
      Stream.runDrain(onInstall),
      Stream.runDrain(onTabRemoved),
      Stream.runDrain(onNavigation),
    ],
    { concurrency: 'unbounded', discard: true },
  );
}).pipe(Effect.scoped);

export function main(): void {
  // Synchronous, before any await: catches the install / click / command that woke the worker.
  primeEarlyEvents();
  const runtime = ManagedRuntime.make(BackgroundLive);
  runtime.runFork(program);
}
