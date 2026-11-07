import { Layer } from 'effect';
import { NoteRepoLive } from './note-repo';
import { SessionRepoLive } from './session-repo';
import { SettingsRepoLive } from './settings-repo';
import { ShotStoreLive } from './shot-store-idb';
import { ShotStoreMemory } from './shot-store';
import {
  ChromeStorageLive,
  ChromeStorageMemory,
  SessionStoreLive,
  SessionStoreMemory,
} from './services';
import type { FaultControl } from './memory-kv';

const ReposLive = Layer.mergeAll(SettingsRepoLive, SessionRepoLive, NoteRepoLive);

/** Everything in production: chrome.storage.local/session, repos, IndexedDB shots. */
export const StorageLive = Layer.mergeAll(
  ReposLive.pipe(Layer.provideMerge(ChromeStorageLive)),
  SessionStoreLive,
  ShotStoreLive,
);

/** Same graph over memory; pass a FaultControl to simulate quota or outage. */
export const makeStorageMemory = (control?: FaultControl) =>
  Layer.mergeAll(
    ReposLive.pipe(Layer.provideMerge(ChromeStorageMemory(control))),
    SessionStoreMemory(),
    ShotStoreMemory,
  );

export const StorageMemory = makeStorageMemory();
