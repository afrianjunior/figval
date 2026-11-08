import { Duration, Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { TestDriver, TestRecorder } from '../platform';
import { SessionRepo, SessionStore, SettingsRepo } from '../storage';
import { activationKey, missingKey } from './keys';
import { program } from './main';
import { makeHarness, tabIdOf } from './test-harness';

let h = makeHarness();
const existingSession = {
  schemaVersion: 1 as const,
  id: 'fv-olds' as never,
  name: 'Before onboarding',
  createdAt: 1,
  updatedAt: 1,
  nextSeq: 2 as never,
  noteOrder: [],
};
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
        yield* driver.emitUpdate({ tabId: id, status: 'complete' });
        yield* driver.emitUpdate({ tabId: id, status: 'loading', url: 'https://example.com/next' });
        yield* settle;
        const sameOrigin = yield* store.get(activationKey(id));
        yield* store.set(missingKey(id), []);
        yield* driver.navigate(id, 'https://other.org/');
        yield* driver.emitUpdate({ tabId: id, status: 'loading', url: 'https://other.org/' });
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
          sameOrigin,
          afterNavigate,
          missingAfterNav: yield* store.get(missingKey(id)),
          afterCommand,
          afterClose: yield* store.get(activationKey(id)),
          missing: yield* store.get(missingKey(id)),
          panel: calls.filter((c) => c.service === 'SidePanel'),
        };
      }),
    );
    expect(result.afterClick).toMatchObject({ active: true });
    expect(result.sameOrigin).toMatchObject({ active: true });
    expect(result.afterNavigate).toBeUndefined();
    expect(result.missingAfterNav).toBeUndefined();
    expect(result.afterCommand).toMatchObject({ origin: 'https://other.org' });
    expect(result.afterClose).toBeUndefined();
    expect(result.missing).toBeUndefined();
    expect(result.panel).toEqual([{ service: 'SidePanel', op: 'setPanelBehavior', args: [false] }]);
    expect(h.fault.contentAccessGrants()).toBe(1);
    expect(h.contentCalls.filter((c) => c === 'PickerStart')).toHaveLength(2);
  });

  it('opens the welcome page on a fresh install only', async () => {
    h = makeHarness();
    const opened = await h.run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* driver.emitInstall('update');
        yield* driver.emitInstall('chrome_update');
        yield* driver.emitInstall('install');
        yield* settle;
        return (yield* (yield* TestRecorder).calls).filter((c) => c.service === 'Extension');
      }),
    );
    expect(opened).toEqual([{ service: 'Extension', op: 'openPage', args: ['/welcome.html'] }]);
  });

  it('on update, treats users who already have sessions as onboarded', async () => {
    h = makeHarness();
    const settings = await h.run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* driver.emitInstall('update');
        yield* settle;
        const before = yield* (yield* SettingsRepo).get;
        yield* (yield* SessionRepo).insert(existingSession);
        yield* driver.emitInstall('update');
        yield* settle;
        return { before, after: yield* (yield* SettingsRepo).get };
      }),
    );
    expect(settings.before).toMatchObject({ checklistDismissed: false, tooltipHintSeen: false });
    expect(settings.after).toMatchObject({ checklistDismissed: true, tooltipHintSeen: true });
  });
});

