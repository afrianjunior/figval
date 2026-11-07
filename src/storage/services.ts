import { Context, Layer } from 'effect';
import { makeAreaKv } from './area-kv';
import { makeFaultControl, makeMemoryKv, type FaultControl } from './memory-kv';
import type { KvService } from './types';

/** chrome.storage.local: sessions, notes, settings. */
export class ChromeStorage extends Context.Tag('figval/ChromeStorage')<
  ChromeStorage,
  KvService
>() {}

/** chrome.storage.session: per-tab activation state and tooltip drafts. */
export class SessionStore extends Context.Tag('figval/SessionStore')<SessionStore, KvService>() {}

export const ChromeStorageLive = Layer.sync(ChromeStorage, () => makeAreaKv('local'));
export const SessionStoreLive = Layer.sync(SessionStore, () => makeAreaKv('session'));

export const ChromeStorageMemory = (control: FaultControl = makeFaultControl()) =>
  Layer.sync(ChromeStorage, () => makeMemoryKv(control));
export const SessionStoreMemory = (control: FaultControl = makeFaultControl()) =>
  Layer.sync(SessionStore, () => makeMemoryKv(control));
