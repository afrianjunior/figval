import { Duration, Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { TestDriver, TestRecorder } from '../platform';
import { SessionStore } from '../storage';
import { activationKey, missingKey } from './keys';
import { program } from './main';
import { makeHarness, tabIdOf } from './test-harness';

let h = makeHarness();
afterEach(() => h.runtime.dispose());

const settle = Effect.sleep(Duration.millis(40));

describe('background program', () => {
  it('wires toolbar, command, navigation and tab-close streams', async () => {
    h = makeHarness();
    const id = tabIdOf(1);
    const result = await h.run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        const store = yield* SessionStore;
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* driver.clickAction(id);
        yield* settle;
        const afterClick = yield* store.get(activationKey(id));
        yield* driver.navigate(id, 'https://other.org/');
        yield* settle;
        const afterNavigate = yield* store.get(activationKey(id));
        yield* driver.emitCommand('other');
        yield* driver.emitCommand('pick');
        yield* settle;
        const afterCommand = yield* store.get(activationKey(id));
        yield* store.set(missingKey(id), []);
        yield* driver.removeTab(id);
        yield* settle;
        const calls = yield* (yield* TestRecorder).calls;
        return {
          afterClick,
          afterNavigate,
          afterCommand,
          afterClose: yield* store.get(activationKey(id)),
          missing: yield* store.get(missingKey(id)),
          panel: calls.filter((c) => c.service === 'SidePanel'),
        };
      }),
    );
    expect(result.afterClick).toMatchObject({ active: true });
    expect(result.afterNavigate).toBeUndefined();
    expect(result.afterCommand).toMatchObject({ origin: 'https://other.org' });
    expect(result.afterClose).toBeUndefined();
    expect(result.missing).toBeUndefined();
    expect(result.panel).toEqual([{ service: 'SidePanel', op: 'setPanelBehavior', args: [true] }]);
    expect(h.contentCalls.filter((c) => c === 'PickerStart')).toHaveLength(2);
  });
});
