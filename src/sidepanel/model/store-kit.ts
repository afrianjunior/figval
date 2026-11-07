import { Effect } from 'effect';
import { TestClock } from 'effect';
import { vi } from 'vitest';
import type { Note, Session, Settings } from '../../domain';
import { defaultSettings } from '../../domain';
import { TestDriver, TestRecorder, type PlatformTestConfig } from '../../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo } from '../../storage';
import { createPanelStore, type PanelStore, type PanelStoreOptions } from './store';
import type { ModelState } from './state';
import { makeHarness, runTest, type Harness } from './test-kit';

export interface Booted {
  readonly store: PanelStore;
  readonly harness: Harness;
  readonly model: () => ModelState;
  readonly waitFor: (predicate: (m: ModelState) => boolean) => Promise<void>;
  readonly advance: (ms: number) => Promise<void>;
  readonly recorded: () => Promise<readonly { service: string; op: string; args: readonly unknown[] }[]>;
  readonly driver: <A>(f: (d: TestDriver['Type']) => Effect.Effect<A>) => Promise<A>;
}

export interface Seed {
  readonly settings?: Partial<Settings>;
  readonly sessions?: readonly Session[];
  readonly notes?: readonly Note[];
  readonly kv?: Readonly<Record<string, unknown>>;
}

export const seedStore = (store: PanelStore, seed: Seed): Promise<void> =>
  store.run(
    Effect.gen(function* () {
      const sessions = yield* SessionRepo;
      const notes = yield* NoteRepo;
      const settings = yield* SettingsRepo;
      const kv = yield* SessionStore;
      for (const s of seed.sessions ?? []) yield* sessions.insert(s);
      for (const n of seed.notes ?? []) yield* notes.insert(n);
      if (seed.settings) yield* settings.put({ ...defaultSettings, ...seed.settings });
      for (const [k, v] of Object.entries(seed.kv ?? {})) yield* kv.set(k, v);
    }),
  );

export const boot = async (
  config: PlatformTestConfig = {},
  options: PanelStoreOptions = {},
  seed: Seed = {},
): Promise<Booted> => {
  const harness = makeHarness(config);
  const store = createPanelStore(harness.layer, options);
  await store.ready;
  await seedStore(store, seed);
  const model = () => store.getSnapshot().model;
  const waitFor = (predicate: (m: ModelState) => boolean) =>
    vi.waitFor(() => {
      if (!predicate(model())) throw new Error('condition not met yet');
    });
  return {
    store,
    harness,
    model,
    waitFor,
    advance: (ms) => runTest(store, TestClock.adjust(ms)),
    recorded: () => runTest(store, Effect.flatMap(TestRecorder, (r) => r.calls)),
    driver: (f) => runTest(store, Effect.flatMap(TestDriver, f)),
  };
};
