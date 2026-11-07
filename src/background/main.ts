import { Effect, Layer, ManagedRuntime, Stream } from 'effect';
import { Messenger, MessengerLive } from '../messaging';
import { Action, Commands, PlatformLive, SidePanel, Tabs } from '../platform';
import { SessionStore, StorageLive } from '../storage';
import { clearActivation, clearIfOriginChanged, ensureActivation } from './activation';
import { missingKey } from './keys';
import { asHandler, type HandleEnv } from './router';

export const BackgroundLive = Layer.mergeAll(StorageLive, PlatformLive, MessengerLive);

const PICK_COMMAND = 'pick';

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

const onTabRemoved = Stream.unwrap(Effect.map(Tabs, (t) => t.onRemoved)).pipe(
  Stream.mapEffect((tabId) =>
    Effect.flatMap(SessionStore, (s) => s.remove([missingKey(tabId)])).pipe(
      Effect.zipRight(clearActivation(tabId)),
      logged('cleanup'),
    ),
  ),
);

/** Tabs has no onUpdated stream; activeChanges carries the active tab's url on navigation. */
const onNavigation = Stream.unwrap(Effect.map(Tabs, (t) => t.activeChanges)).pipe(
  Stream.mapEffect((tab) => clearIfOriginChanged(tab).pipe(logged('navigation'))),
);

export const program = Effect.gen(function* () {
  const context = yield* Effect.context<HandleEnv>();
  yield* (yield* Messenger).serve('background', asHandler(context));
  yield* (yield* SidePanel).setPanelBehavior(true);
  yield* Effect.all(
    [
      Stream.runDrain(onToolbarClick),
      Stream.runDrain(onPickCommand),
      Stream.runDrain(onTabRemoved),
      Stream.runDrain(onNavigation),
    ],
    { concurrency: 'unbounded', discard: true },
  );
}).pipe(Effect.scoped);

export function main(): void {
  const runtime = ManagedRuntime.make(BackgroundLive);
  runtime.runFork(program);
}
