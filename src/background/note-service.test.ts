import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import type { Note, NoteId, NotePatch, NoteDraft } from '../domain';
import { Messenger } from '../messaging';
import { TestRecorder } from '../platform';
import { NoteRepo, SessionRepo, SettingsRepo } from '../storage';
import { draftOf, makeHarness, tabIdOf, withTextEdit } from './test-harness';

let h = makeHarness();
afterEach(() => h.runtime.dispose());
const fresh = (options?: Parameters<typeof makeHarness>[0]) => {
  h = makeHarness(options);
  return h;
};

const create = (draft: NoteDraft = draftOf(), tabId = 1): Promise<Note> =>
  h.run(
    Effect.flatMap(Messenger, (m) =>
      m.toBackground({ _tag: 'NoteCreate', draft, tabId: tabIdOf(tabId) }),
    ),
  );
const createWithRect = (rect: { x: number; y: number; w: number; h: number }) =>
  h.run(
    Effect.flatMap(Messenger, (m) =>
      m.toBackground({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1), rect }),
    ),
  );
const cropArgs = () =>
  h
    .run(Effect.flatMap(TestRecorder, (r) => r.calls))
    .then((calls) => calls.filter((c) => c.op === 'crop').map((c) => c.args));
const update = (id: NoteId, patch: NotePatch): Promise<Note> =>
  h.run(Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'NoteUpdate', id, patch })));
const remove = (id: NoteId) =>
  h.run(Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'NoteDelete', id })));
const sessions = () => h.run(Effect.flatMap(SessionRepo, (r) => r.list));
const recorded = () =>
  h
    .run(Effect.flatMap(TestRecorder, (r) => r.calls))
    .then((calls) => calls.filter((c) => c.service === 'Capture').map((c) => c.op));

describe('NoteService.create', () => {
  it('creates the session on the first note with seq 1 and the default name', async () => {
    fresh();
    const note = await create();
    const { items } = await sessions();
    const settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(note.seq).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe('example.com · Nov 7');
    expect(items[0]?.nextSeq).toBe(2);
    expect(items[0]?.noteOrder).toEqual([note.id]);
    expect(settings.activeSessionId).toBe(items[0]?.id);
  });

  it('gives the second note seq 2 in the same session', async () => {
    fresh();
    const first = await create();
    const second = await create();
    expect(second.seq).toBe(2);
    expect(second.sessionId).toBe(first.sessionId);
    expect((await sessions()).items[0]?.noteOrder).toEqual([first.id, second.id]);
  });

  it('never reuses a seq after a delete', async () => {
    fresh();
    await create();
    const second = await create();
    await remove(second.id);
    const third = await create();
    expect(third.seq).toBe(3);
  });

  it('captures one shot, stored as before, without edits', async () => {
    fresh();
    const note = await create();
    expect(h.contentCalls).toEqual(['UiHide', 'UiShow']);
    expect(note.shots.before).not.toBeNull();
    expect(note.shots.after).toBeNull();
    expect(await recorded()).toEqual(['visibleTab', 'crop']);
  });

  it('crops to the padded element rect with the page dpr', async () => {
    fresh();
    await createWithRect({ x: 100, y: 50, w: 200, h: 80 });
    expect(await cropArgs()).toEqual([[{ x: 96, y: 46, w: 208, h: 88 }, 2]]);
  });

  it('clamps the padded rect to the viewport', async () => {
    fresh();
    await createWithRect({ x: 1, y: 2, w: 900, h: 599 });
    expect(await cropArgs()).toEqual([[{ x: 0, y: 0, w: 800, h: 600 }, 2]]);
  });

  it('falls back to the viewport for an off-screen rect', async () => {
    fresh();
    await createWithRect({ x: 2000, y: 2000, w: 10, h: 10 });
    expect(await cropArgs()).toEqual([[{ x: 0, y: 0, w: 800, h: 600 }, 2]]);
  });

  it('crops to the viewport when there is no rect', async () => {
    fresh();
    await create();
    expect(await cropArgs()).toEqual([[{ x: 0, y: 0, w: 800, h: 600 }, 2]]);
  });

  it('captures before with edits off and after with edits on', async () => {
    fresh();
    const note = await create(withTextEdit());
    expect(h.contentCalls).toEqual(['UiHide', 'EditsOff', 'EditsOn', 'UiShow']);
    expect(note.shots.before).not.toBeNull();
    expect(note.shots.after).not.toBeNull();
    expect(note.shots.before).not.toBe(note.shots.after);
    expect(await recorded()).toEqual(['visibleTab', 'crop', 'visibleTab', 'crop']);
  });

  it('saves the note without shots when capture fails and still shows the UI', async () => {
    fresh({ platform: { capture: { failWith: 'boom' } } });
    const note = await create();
    expect(note.shots).toEqual({ before: null, after: null });
    expect(h.contentCalls).toEqual(['UiHide', 'UiShow']);
    expect(h.shotLive.size).toBe(0);
  });

  it('skips capture when screenshots are off', async () => {
    fresh();
    await h.run(
      Effect.flatMap(Messenger, (m) =>
        m.toBackground({ _tag: 'SettingsUpdate', patch: { screenshots: false } }),
      ),
    );
    const note = await create();
    expect(note.shots).toEqual({ before: null, after: null });
    expect(h.contentCalls).toEqual([]);
  });

  it('skips capture when the tab cannot be read', async () => {
    fresh();
    const note = await create(draftOf(), 99);
    expect(note.shots.before).toBeNull();
  });

  it('uses the active tab when the message has no tabId', async () => {
    fresh();
    const note = await h.run(
      Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'NoteCreate', draft: draftOf() })),
    );
    expect(note.shots.before).not.toBeNull();
  });

  it('replies with the quota tag and writes nothing when storage is full', async () => {
    fresh();
    h.fault.set({ kind: 'quota', bytesInUse: 1 });
    const failure = await h.run(
      Effect.flip(
        Effect.flatMap(Messenger, (m) =>
          m.toBackground({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) }),
        ),
      ),
    );
    h.fault.set(null);
    expect(failure).toMatchObject({ _tag: 'RemoteFailure', tag: 'StorageQuotaExceeded' });
    expect((await sessions()).items).toHaveLength(0);
    expect(h.shotLive.size).toBe(0);
  });

  it('removes the captured shots when the note insert fails', async () => {
    fresh();
    await create();
    h.shotLive.clear();
    h.fault.set({ kind: 'quota', bytesInUse: 1 });
    await h
      .run(
        Effect.flatMap(Messenger, (m) =>
          m.toBackground({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) }),
        ),
      )
      .catch(() => undefined);
    h.fault.set(null);
    expect(h.shotLive.size).toBe(0);
  });
});

describe('NoteService.update', () => {
  it('patches fields and the label without re-capturing', async () => {
    fresh();
    const note = await create();
    const before = (await recorded()).length;
    const next = await update(note.id, {
      comment: 'smaller',
      why: 'because',
      forceApply: true,
      label: 'Renamed',
    });
    expect(next).toMatchObject({ comment: 'smaller', why: 'because', forceApply: true });
    expect(next.target.label).toBe('Renamed');
    expect((await recorded()).length).toBe(before);
    const stored = await h.run(Effect.flatMap(NoteRepo, (r) => r.get(note.sessionId, note.id)));
    expect(stored._tag === 'Some' && stored.value.comment).toBe('smaller');
  });

  it('re-captures after only when edits changed', async () => {
    fresh();
    const note = await create();
    const edited = await update(note.id, { edits: withTextEdit().edits });
    expect(edited.shots.before).toBe(note.shots.before);
    expect(edited.shots.after).not.toBeNull();
    expect(h.contentCalls.slice(-2)).toEqual(['UiHide', 'UiShow']);
    const again = await update(note.id, {
      edits: { ...withTextEdit().edits, text: { before: 'Start', after: 'Hello' } },
    });
    expect(again.shots.after).toBe(edited.shots.after);
  });

  it('drops the after shot when the edits are cleared', async () => {
    fresh();
    const note = await create(withTextEdit());
    const cleared = await update(note.id, { edits: draftOf().edits });
    expect(cleared.shots.after).toBeNull();
    expect(h.shotLive.size).toBe(1);
  });

  it('keeps the old shots when the page is not in the active tab', async () => {
    fresh({ platform: { tabs: [], activeTabId: null } });
    const note = await create();
    const edited = await update(note.id, { edits: withTextEdit().edits });
    expect(edited.shots).toEqual(note.shots);
  });

  it('keeps the old shots when the re-capture fails', async () => {
    fresh();
    const note = await create();
    h.failContentOn('UiHide');
    const edited = await update(note.id, { edits: withTextEdit().edits });
    expect(edited.shots).toEqual(note.shots);
    expect(edited.edits.text?.after).toBe('Go');
  });

  it('fails with NoteNotFound for an unknown id', async () => {
    fresh();
    const note = await create();
    const failure = await h.run(
      Effect.flip(
        Effect.flatMap(Messenger, (m) =>
          m.toBackground({
            _tag: 'NoteUpdate',
            id: '00000000-0000-4000-8000-000000000000' as NoteId,
            patch: {},
          }),
        ),
      ),
    );
    expect(failure).toMatchObject({ tag: 'NoteNotFound' });
    expect(note.seq).toBe(1);
  });
});

describe('NoteService.delete', () => {
  it('removes the note, its shots and its place in noteOrder', async () => {
    fresh();
    const note = await create(withTextEdit());
    expect(h.shotLive.size).toBe(2);
    await remove(note.id);
    const { items } = await sessions();
    expect(items[0]?.noteOrder).toEqual([]);
    expect(h.shotLive.size).toBe(0);
    const left = await h.run(Effect.flatMap(NoteRepo, (r) => r.list(note.sessionId)));
    expect(left.items).toHaveLength(0);
  });
});
