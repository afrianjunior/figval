import { Context, Layer } from 'effect';
import { makeAreaKv, makeSessionKv } from './area-kv';
import {
  makeFaultControl,
  makeMemoryKv,
  makeMemorySessionKv,
  type FaultControl,
} from './memory-kv';
import type { KvService, SessionKvService } from './types';

/** chrome.storage.local: sessions, notes, settings. */
export class ChromeStorage extends Context.Tag('figval/ChromeStorage')<
  ChromeStorage,
  KvService
>() {}

/** chrome.storage.session: per-tab activation state and tooltip drafts. */
export class SessionStore extends Context.Tag('figval/SessionStore')<
  SessionStore,
  SessionKvService
>() {}

export const ChromeStorageLive = Layer.sync(ChromeStorage, () => makeAreaKv('local'));
export const SessionStoreLive = Layer.sync(SessionStore, () => makeSessionKv());

export const ChromeStorageMemory = (control: FaultControl = makeFaultControl()) =>
  Layer.sync(ChromeStorage, () => makeMemoryKv(control));
export const SessionStoreMemory = (control: FaultControl = makeFaultControl()) =>
  Layer.sync(SessionStore, () => makeMemorySessionKv(control));
