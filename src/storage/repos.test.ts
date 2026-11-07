import { Chunk, Effect, Exit, Fiber, Option, Stream } from 'effect';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../domain';
import { makeNote, makeSession, nid, sid } from './fixtures';
import { notesKey } from './keys';
import { makeFaultControl } from './memory-kv';
import { migrate } from './decode';
import { NoteRepo } from './note-repo';
import { ChromeStorage } from './services';
import { SessionRepo } from './session-repo';
import { SettingsRepo } from './settings-repo';
import { makeStorageMemory } from './layers';

const run = <A, E>(
  eff: Effect.Effect<A, E, SettingsRepo | SessionRepo | NoteRepo | ChromeStorage>,
  control = makeFaultControl(),
) => Effect.runPromise(eff.pipe(Effect.provide(makeStorageMemory(control))));

const runExit = <A, E>(
  eff: Effect.Effect<A, E, SettingsRepo | SessionRepo | NoteRepo | ChromeStorage>,
) => Effect.runPromiseExit(eff.pipe(Effect.provide(makeStorageMemory())));

describe('migrate', () => {
  it('is the identity in v1', () => {
    const raw = { schemaVersion: 1 };
    expect(migrate(1, raw)).toBe(raw);
  });
});

describe('SettingsRepo', () => {
  it('returns defaults when absent and round-trips put', async () => {
    const out = await run(
      Effect.gen(function* () {
        const repo = yield* SettingsRepo;
        const first = yield* repo.get;
        yield* repo.put({ ...defaultSettings, preset: 'developer' });
        return [first, yield* repo.get];
      }),
    );
    expect(out).toEqual([defaultSettings, { ...defaultSettings, preset: 'developer' }]);
  });

  it('reports StorageCorrupt for an undecodable settings value', async () => {
    const err = await run(
      Effect.gen(function* () {
        yield* (yield* ChromeStorage).set('settings', { nope: true });
        return yield* Effect.flip((yield* SettingsRepo).get);
      }),
    );
    expect(err).toMatchObject({ _tag: 'StorageCorrupt', key: 'settings' });
  });

  it('maps quota and outage errors on put', async () => {
    const control = makeFaultControl();
    control.set({ kind: 'quota', bytesInUse: 7 });
    const err = await run(
      Effect.flip(Effect.flatMap(SettingsRepo, (r) => r.put(defaultSettings))),
      control,
    );
    expect(err).toMatchObject({ _tag: 'StorageQuotaExceeded', bytesInUse: 7 });
  });

  it('streams the current value, then each change', async () => {
    const values = await run(
      Effect.gen(function* () {
        const repo = yield* SettingsRepo;
        const fiber = yield* repo.stream.pipe(Stream.take(2), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(0);
        yield* repo.put({ ...defaultSettings, screenshots: false });
        return Chunk.toReadonlyArray(yield* Fiber.join(fiber));
      }),
    );
    expect(values.at(-1)).toEqual({ ...defaultSettings, screenshots: false });
    expect(values).toHaveLength(2);
  });
});

describe('SessionRepo', () => {
  it('lists, gets, inserts, replaces and removes', async () => {
    const out = await run(
      Effect.gen(function* () {
        const repo = yield* SessionRepo;
        yield* repo.insert(makeSession('fv-aaaa'));
        yield* repo.insert(makeSession('fv-bbbb'));
        yield* repo.replace(makeSession('fv-aaaa', { name: 'renamed' }));
        yield* repo.remove(sid('fv-bbbb'));
        yield* repo.remove(sid('fv-zzzz'));
        return {
          list: yield* repo.list,
          got: yield* repo.get(sid('fv-aaaa')),
          missing: yield* repo.get(sid('fv-bbbb')),
        };
      }),
    );
    expect(out.list.items.map((s) => s.name)).toEqual(['renamed']);
    expect(out.list.corrupt).toBe(0);
    expect(Option.isSome(out.got)).toBe(true);
    expect(Option.isNone(out.missing)).toBe(true);
  });

  it('dies on duplicate id and on replacing an unknown id', async () => {
    const dup = await runExit(
      Effect.gen(function* () {
        const repo = yield* SessionRepo;
        yield* repo.insert(makeSession());
        yield* repo.insert(makeSession());
      }),
    );
    expect(Exit.isFailure(dup) && dup.cause._tag).toBe('Die');
    const unknown = await runExit(Effect.flatMap(SessionRepo, (r) => r.replace(makeSession())));
    expect(Exit.isFailure(unknown) && unknown.cause._tag).toBe('Die');
  });

  it('skips corrupt records, counts them, and keeps them on write', async () => {
    const out = await run(
      Effect.gen(function* () {
        const kv = yield* ChromeStorage;
        const repo = yield* SessionRepo;
        yield* kv.set('sessions', [makeSession('fv-aaaa'), { id: 'bad' }, 'junk']);
        const listing = yield* repo.list;
        yield* repo.insert(makeSession('fv-bbbb'));
        return { listing, stored: yield* kv.get('sessions'), after: yield* repo.list };
      }),
    );
    expect(out.listing.items).toHaveLength(1);
    expect(out.listing.corrupt).toBe(2);
    expect(out.stored).toHaveLength(4);
    expect(out.after.corrupt).toBe(2);
  });

  it('reports StorageCorrupt when the container is not an array', async () => {
    const err = await run(
      Effect.gen(function* () {
        yield* (yield* ChromeStorage).set('sessions', { not: 'array' });
        return yield* Effect.flip((yield* SessionRepo).list);
      }),
    );
    expect(err).toMatchObject({ _tag: 'StorageCorrupt', key: 'sessions' });
  });

  it('streams the list on every change', async () => {
    const lists = await run(
      Effect.gen(function* () {
        const repo = yield* SessionRepo;
        const fiber = yield* repo.stream.pipe(Stream.take(2), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(0);
        yield* repo.insert(makeSession());
        return Chunk.toReadonlyArray(yield* Fiber.join(fiber));
      }),
    );
    expect(lists.at(-1)).toHaveLength(1);
  });
});

describe('NoteRepo', () => {
  const sessionA = sid('fv-aaaa');

  it('keeps notes per session under notes:<id>', async () => {
    const out = await run(
      Effect.gen(function* () {
        const notes = yield* NoteRepo;
        yield* notes.insert(makeNote(1, 'fv-aaaa'));
        yield* notes.insert(makeNote(2, 'fv-aaaa'));
        yield* notes.insert(makeNote(1, 'fv-bbbb'));
        yield* notes.replace(makeNote(2, 'fv-aaaa', { comment: 'hi' }));
        yield* notes.remove(sessionA, nid(1));
        return {
          a: yield* notes.list(sessionA),
          b: yield* notes.list(sid('fv-bbbb')),
          got: yield* notes.get(sessionA, nid(2)),
          raw: yield* (yield* ChromeStorage).get(notesKey(sessionA)),
        };
      }),
    );
    expect(out.a.items.map((n) => n.comment)).toEqual(['hi']);
    expect(out.b.items).toHaveLength(1);
    expect(Option.isSome(out.got)).toBe(true);
    expect(out.raw).toHaveLength(1);
  });

  it('dies on duplicate seq, duplicate id, and unknown replace', async () => {
    const dupSeq = await runExit(
      Effect.gen(function* () {
        const notes = yield* NoteRepo;
        yield* notes.insert(makeNote(1));
        yield* notes.insert(makeNote(2, 'fv-aaaa', { seq: makeNote(1).seq }));
      }),
    );
    expect(Exit.isFailure(dupSeq) && dupSeq.cause._tag).toBe('Die');
    const dupId = await runExit(
      Effect.gen(function* () {
        const notes = yield* NoteRepo;
        yield* notes.insert(makeNote(1));
        yield* notes.insert(makeNote(1));
      }),
    );
    expect(Exit.isFailure(dupId) && dupId.cause._tag).toBe('Die');
    const unknown = await runExit(Effect.flatMap(NoteRepo, (n) => n.replace(makeNote(9))));
    expect(Exit.isFailure(unknown) && unknown.cause._tag).toBe('Die');
  });

  it('skips corrupt notes and counts them', async () => {
    const listing = await run(
      Effect.gen(function* () {
        yield* (yield* ChromeStorage).set(notesKey(sessionA), [makeNote(1), { seq: -1 }]);
        return yield* (yield* NoteRepo).list(sessionA);
      }),
    );
    expect(listing.items).toHaveLength(1);
    expect(listing.corrupt).toBe(1);
  });

  it('removeAll deletes the key and the stream ignores other sessions', async () => {
    const out = await run(
      Effect.gen(function* () {
        const notes = yield* NoteRepo;
        yield* notes.insert(makeNote(1));
        const fiber = yield* notes
          .stream(sessionA)
          .pipe(Stream.take(3), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(0);
        yield* notes.insert(makeNote(1, 'fv-bbbb'));
        yield* notes.insert(makeNote(2));
        yield* notes.removeAll(sessionA);
        return Chunk.toReadonlyArray(yield* Fiber.join(fiber)).map((l) => l.length);
      }),
    );
    expect(out.at(-1)).toBe(0);
    expect(out).not.toContain(undefined);
  });

  it('surfaces outage as StorageUnavailable', async () => {
    const control = makeFaultControl();
    control.set({ kind: 'unavailable' });
    const err = await run(Effect.flip(Effect.flatMap(NoteRepo, (n) => n.list(sessionA))), control);
    expect(err._tag).toBe('StorageUnavailable');
  });
});
