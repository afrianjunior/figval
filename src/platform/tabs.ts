import { Context, Effect, Layer, Option, Schema, Stream } from 'effect';
import { TabId, UnsupportedPage } from '../domain';
import { chromeApi } from './chrome-api';
import { TestDriver } from './test-driver';
import type { TabInfo } from './types';

export interface TabsService {
  /** A tab that cannot be read fails as UnsupportedPage (url unknown, so empty). */
  readonly get: (tabId: TabId) => Effect.Effect<TabInfo, UnsupportedPage>;
  readonly queryActive: Effect.Effect<Option.Option<TabInfo>>;
  /** Emits the active tab when the user switches tabs or the active tab finishes loading/navigates. */
  readonly activeChanges: Stream.Stream<TabInfo>;
  readonly onRemoved: Stream.Stream<TabId>;
}

export class Tabs extends Context.Tag('figval/platform/Tabs')<Tabs, TabsService>() {}

type ChromeTab = {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
  readonly title?: string | undefined;
  readonly windowId: number;
};

export const toTabInfo = (tab: ChromeTab): Option.Option<TabInfo> =>
  Option.map(Schema.decodeUnknownOption(TabId)(tab.id), (id) => ({
    id,
    url: tab.url ?? '',
    title: tab.title ?? '',
    windowId: tab.windowId,
  }));

const unreadable = () => new UnsupportedPage({ url: '' });

const activeChanges: Stream.Stream<TabInfo> = Stream.asyncPush<TabInfo>((emit) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const api = chromeApi().tabs;
      const onActivated = (info: { tabId: number }) => {
        void api.get(info.tabId).then((tab) => Option.map(toTabInfo(tab), emit.single));
      };
      const onUpdated = (_id: number, change: { status?: string; url?: string }, tab: ChromeTab & { active?: boolean }) => {
        if (tab.active && (change.status !== undefined || change.url !== undefined)) {
          Option.map(toTabInfo(tab), emit.single);
        }
      };
      api.onActivated.addListener(onActivated);
      api.onUpdated.addListener(onUpdated);
      return { onActivated, onUpdated };
    }),
    ({ onActivated, onUpdated }) =>
      Effect.sync(() => {
        const api = chromeApi().tabs;
        api.onActivated.removeListener(onActivated);
        api.onUpdated.removeListener(onUpdated);
      }),
  ),
);

const onRemoved: Stream.Stream<TabId> = Stream.asyncPush<TabId>((emit) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const listener = (id: number) => {
        Option.map(Schema.decodeUnknownOption(TabId)(id), emit.single);
      };
      chromeApi().tabs.onRemoved.addListener(listener);
      return listener;
    }),
    (listener) => Effect.sync(() => chromeApi().tabs.onRemoved.removeListener(listener)),
  ),
);

export const TabsLive: Layer.Layer<Tabs> = Layer.succeed(Tabs, {
  get: (tabId) =>
    Effect.tryPromise({ try: () => chromeApi().tabs.get(tabId), catch: unreadable }).pipe(
      Effect.flatMap((tab) => Option.match(toTabInfo(tab), { onNone: () => Effect.fail(unreadable()), onSome: Effect.succeed })),
    ),
  queryActive: Effect.promise(() => chromeApi().tabs.query({ active: true, lastFocusedWindow: true })).pipe(
    Effect.map((tabs) => Option.flatMap(Option.fromNullable(tabs[0]), toTabInfo)),
    Effect.catchAllDefect(() => Effect.succeed(Option.none<TabInfo>())),
  ),
  activeChanges,
  onRemoved,
});

export const TabsTest: Layer.Layer<Tabs, never, TestDriver> = Layer.effect(
  Tabs,
  Effect.map(TestDriver, (driver): TabsService => ({
    get: (tabId) =>
      driver.tabs.pipe(
        Effect.flatMap((tabs) => {
          const tab = tabs.find((t) => t.id === tabId);
          return tab ? Effect.succeed(tab) : Effect.fail(unreadable());
        }),
      ),
    queryActive: Effect.gen(function* () {
      const id = yield* driver.activeTabId;
      const tabs = yield* driver.tabs;
      return Option.fromNullable(tabs.find((t) => t.id === id));
    }),
    activeChanges: Stream.fromPubSub(driver.tabEvents),
    onRemoved: Stream.fromPubSub(driver.removedEvents),
  })),
);
