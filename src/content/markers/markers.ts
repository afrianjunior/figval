import { Effect, Runtime, type Scope } from 'effect';
import { formatSeq, hasEdits, type Note, type NoteId } from '../../domain';
import { findElement } from '../../locator';
import { MissingReport, Messenger } from '../../messaging';
import { SessionStore } from '../../storage';
import type { EditRegistry } from '../edit';
import { createOutlineBox, makeFrameScheduler, TooltipPort, type OverlayHost } from '../picker';
import { mountPin, type PinView } from './pin-view';

export const HOVER_KEY = 'hover';
const PREVIEW_MAX = 140;
const PULSE_MS = 900;
const PIN_WIDTH = 56;
const PIN_HEIGHT = 24;
const PIN_OVERLAP = 8;

export interface MarkerLayerOptions {
  readonly doc: Document;
  readonly host: OverlayHost;
  readonly registry: EditRegistry;
}

export interface MarkerLayer {
  readonly render: (notes: readonly Note[], highlightId?: NoteId) => Effect.Effect<void>;
  readonly clear: Effect.Effect<void>;
  readonly highlight: (noteId: NoteId | null) => Effect.Effect<void>;
  readonly scrollTo: (noteId: NoteId) => Effect.Effect<void>;
  readonly reopen: (noteId: NoteId) => Effect.Effect<void>;
  readonly elementOf: (noteId: string) => Element | null;
  readonly notes: () => readonly Note[];
}

interface Entry {
  readonly note: Note;
  readonly el: Element;
  readonly slot: HTMLElement;
  readonly view: PinView;
}

const preview = (note: Note): string => {
  const text = note.comment.trim() || note.target.label;
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
};

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, max));

/** Pins for every found note, kept in place by a rAF-throttled scroll/resize/observer loop. */
export const makeMarkerLayer = (
  options: MarkerLayerOptions,
): Effect.Effect<MarkerLayer, never, Scope.Scope | Messenger | SessionStore | TooltipPort> =>
  Effect.gen(function* () {
    const messenger = yield* Messenger;
    const store = yield* SessionStore;
    const port = yield* TooltipPort;
    const run = Runtime.runFork(yield* Effect.runtime<never>());
    const { doc, host, registry } = options;
    const win = doc.defaultView as Window;

    let entries: ReadonlyMap<NoteId, Entry> = new Map();
    let notes: readonly Note[] = [];
    let highlightId: NoteId | null = null;
    let pulseTimer: number | undefined;
    const outline = createOutlineBox(host.layer, 'fv-ov-box--note');
    const pulse = createOutlineBox(host.layer, 'fv-ov-box--pulse');
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => frame.schedule());

    const place = (entry: Entry): void => {
      const rect = entry.el.getBoundingClientRect();
      const w = win.innerWidth;
      const h = win.innerHeight;
      const offscreen = rect.bottom < 0 || rect.top > h || rect.right < 0 || rect.left > w;
      entry.slot.style.visibility = offscreen || !entry.el.isConnected ? 'hidden' : 'visible';
      const x = clamp(rect.right - PIN_OVERLAP, 0, Math.max(0, w - PIN_WIDTH));
      const y = clamp(rect.top - PIN_HEIGHT, 0, Math.max(0, h - PIN_HEIGHT));
      entry.slot.style.transform = `translate(${x}px, ${y}px)`;
    };
    const tick = (): void => {
      entries.forEach(place);
      const lit = highlightId ? entries.get(highlightId) : undefined;
      if (lit) outline.show(lit.el);
      else outline.hide();
    };
    const frame = makeFrameScheduler(win, tick);

    const writeHover = (noteId: NoteId | null): void => {
      const value = noteId ? { noteId, at: Date.now() } : null;
      run(store.set(HOVER_KEY, value).pipe(Effect.ignore));
    };
    const reopen = (note: Note, el: Element): Effect.Effect<void> =>
      port.openTooltip(note.target, { mode: 'reopen', noteId: note.id, anchor: el, registry });

    const pinProps = (note: Note, el: Element) => ({
      children: formatSeq(note.seq),
      preview: preview(note),
      active: note.id === highlightId,
      onClick: () => run(reopen(note, el)),
      onPointerEnter: () => (applyHighlight(note.id), writeHover(note.id)),
      onPointerLeave: () => (applyHighlight(null), writeHover(null)),
      onFocus: () => writeHover(note.id),
      onBlur: () => writeHover(null),
    });

    const applyHighlight = (noteId: NoteId | null): void => {
      highlightId = noteId;
      entries.forEach((e) => e.view.update(pinProps(e.note, e.el)));
      frame.schedule();
      tick();
    };

    const mount = (note: Note, el: Element): Entry => {
      const slot = doc.createElement('div');
      slot.className = 'fv-slot';
      host.layer.append(slot);
      const view = mountPin(slot, pinProps(note, el));
      observer?.observe(el);
      return { note, el, slot, view };
    };

    const teardown = (): void => {
      observer?.disconnect();
      entries.forEach((e) => (e.view.unmount(), e.slot.remove()));
      entries = new Map();
    };

    const syncEdits = (found: ReadonlyMap<NoteId, Entry>): void => {
      const keep = new Set<string>();
      found.forEach(({ note, el }) => {
        if (!hasEdits(note)) return;
        keep.add(note.id);
        registry.apply(note.id, el, note.edits);
      });
      registry.entries().forEach(({ noteId }) => {
        if (!keep.has(noteId)) registry.remove(noteId);
      });
    };

    const render = (next: readonly Note[], highlight?: NoteId): Effect.Effect<void> =>
      Effect.suspend(() => {
        teardown();
        notes = next;
        highlightId = highlight ?? null;
        const found = new Map<NoteId, Entry>();
        const missing: NoteId[] = [];
        next.forEach((note) => {
          const el = findElement(note.target, doc);
          if (el) found.set(note.id, mount(note, el));
          else missing.push(note.id);
        });
        entries = found;
        syncEdits(found);
        tick();
        return report(missing, next.length);
      });

    // divergent: the report is fire-and-forget; a sleeping background must never block rendering.
    const report = (ids: readonly NoteId[], total: number): Effect.Effect<void> =>
      total === 0
        ? Effect.void
        : messenger.toBackground(MissingReport.make({ ids })).pipe(
            Effect.catchAll((error) => Effect.logWarning('MissingReport failed', error._tag)),
            Effect.forkDaemon,
            Effect.asVoid,
          );

    const scrollTo = (noteId: NoteId): Effect.Effect<void> =>
      Effect.sync(() => {
        const el = entries.get(noteId)?.el ?? lookup(noteId);
        if (!el) return;
        if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
        win.clearTimeout(pulseTimer);
        pulse.show(el);
        pulse.el.classList.remove('fv-ov-box--pulse');
        void pulse.el.offsetWidth;
        pulse.el.classList.add('fv-ov-box--pulse');
        pulseTimer = win.setTimeout(pulse.hide, PULSE_MS);
        frame.schedule();
      });

    const lookup = (noteId: string): Element | null => {
      const note = notes.find((n) => n.id === noteId);
      return note ? findElement(note.target, doc) : null;
    };

    const onViewport = (): void => frame.schedule();
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        win.addEventListener('scroll', onViewport, { capture: true, passive: true });
        win.addEventListener('resize', onViewport);
      }),
      () =>
        Effect.sync(() => {
          win.removeEventListener('scroll', onViewport, true);
          win.removeEventListener('resize', onViewport);
          win.clearTimeout(pulseTimer);
          frame.cancel();
          teardown();
          outline.remove();
          pulse.remove();
        }),
    );

    return {
      render,
      clear: Effect.sync(() => {
        teardown();
        notes = [];
        highlightId = null;
        outline.hide();
        pulse.hide();
        syncEdits(new Map());
      }),
      highlight: (noteId) => Effect.sync(() => applyHighlight(noteId)),
      scrollTo,
      reopen: (noteId) =>
        Effect.suspend(() => {
          const note = notes.find((n) => n.id === noteId);
          const el = note ? (entries.get(noteId)?.el ?? lookup(noteId)) : null;
          return note && el ? reopen(note, el) : Effect.void;
        }),
      elementOf: lookup,
      notes: () => notes,
    };
  });
