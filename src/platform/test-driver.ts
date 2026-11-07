import { Context, Effect, Layer, PubSub, Ref } from 'effect';
import type { TabId } from '../domain';
import type { TabInfo, TabUpdate } from './types';

export interface RecordedCall {
  readonly service: string;
  readonly op: string;
  readonly args: readonly unknown[];
}

/** Every test layer appends here; tests read it to assert on what the code under test did. */
export class TestRecorder extends Context.Tag('figval/platform/TestRecorder')<
  TestRecorder,
  {
    readonly record: (call: RecordedCall) => Effect.Effect<void>;
    readonly calls: Effect.Effect<readonly RecordedCall[]>;
  }
>() {}

export const TestRecorderLive: Layer.Layer<TestRecorder> = Layer.effect(
  TestRecorder,
  Effect.map(Ref.make<readonly RecordedCall[]>([]), (ref) => ({
    record: (call: RecordedCall) => Ref.update(ref, (calls) => [...calls, call]),
    calls: Ref.get(ref),
  })),
);

/** Test-side remote control for browser events (tab changes, commands, toolbar clicks). */
export interface TestDriverService {
  readonly tabs: Effect.Effect<readonly TabInfo[]>;
  readonly activeTabId: Effect.Effect<TabId | null>;
  readonly tabEvents: PubSub.PubSub<TabInfo>;
  readonly removedEvents: PubSub.PubSub<TabId>;
  readonly updateEvents: PubSub.PubSub<TabUpdate>;
  readonly commandEvents: PubSub.PubSub<string>;
  readonly actionEvents: PubSub.PubSub<TabInfo>;
  readonly addTab: (tab: TabInfo) => Effect.Effect<void>;
  readonly activate: (id: TabId) => Effect.Effect<void>;
  readonly navigate: (id: TabId, url: string) => Effect.Effect<void>;
  readonly emitUpdate: (update: TabUpdate) => Effect.Effect<void>;
  readonly removeTab: (id: TabId) => Effect.Effect<void>;
  readonly emitCommand: (name: string) => Effect.Effect<void>;
  readonly clickAction: (id: TabId) => Effect.Effect<void>;
}

export class TestDriver extends Context.Tag('figval/platform/TestDriver')<TestDriver, TestDriverService>() {}

const makeDriver = (initial: readonly TabInfo[], active: TabId | null) =>
  Effect.gen(function* () {
    const state = yield* Ref.make({ tabs: initial, active });
    const tabEvents = yield* PubSub.unbounded<TabInfo>();
    const removedEvents = yield* PubSub.unbounded<TabId>();
    const updateEvents = yield* PubSub.unbounded<TabUpdate>();
    const commandEvents = yield* PubSub.unbounded<string>();
    const actionEvents = yield* PubSub.unbounded<TabInfo>();
    const find = (id: TabId) =>
      Ref.get(state).pipe(Effect.map((s) => s.tabs.find((t) => t.id === id)));
    const publishIfActive = (id: TabId) =>
      Effect.gen(function* () {
        const s = yield* Ref.get(state);
        const tab = s.tabs.find((t) => t.id === id);
        if (tab && s.active === id) yield* PubSub.publish(tabEvents, tab);
      });
    const service: TestDriverService = {
      tabs: Effect.map(Ref.get(state), (s) => s.tabs),
      activeTabId: Effect.map(Ref.get(state), (s) => s.active),
      tabEvents,
      removedEvents,
      updateEvents,
      commandEvents,
      actionEvents,
      addTab: (tab) => Ref.update(state, (s) => ({ ...s, tabs: [...s.tabs, tab] })),
      activate: (id) =>
        Ref.update(state, (s) => ({ ...s, active: id })).pipe(Effect.zipRight(publishIfActive(id))),
      navigate: (id, url) =>
        Ref.update(state, (s) => ({
          ...s,
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, url } : t)),
        })).pipe(Effect.zipRight(publishIfActive(id))),
      removeTab: (id) =>
        Ref.update(state, (s) => ({
          tabs: s.tabs.filter((t) => t.id !== id),
          active: s.active === id ? null : s.active,
        })).pipe(Effect.zipRight(PubSub.publish(removedEvents, id)), Effect.asVoid),
      emitUpdate: (update) => PubSub.publish(updateEvents, update).pipe(Effect.asVoid),
      emitCommand: (name) => PubSub.publish(commandEvents, name).pipe(Effect.asVoid),
      clickAction: (id) =>
        find(id).pipe(
          Effect.flatMap((tab) => (tab ? PubSub.publish(actionEvents, tab) : Effect.void)),
          Effect.asVoid,
        ),
    };
    return service;
  });

export const TestDriverLive = (
  initial: readonly TabInfo[] = [],
  active: TabId | null = null,
): Layer.Layer<TestDriver> => Layer.effect(TestDriver, makeDriver(initial, active));
