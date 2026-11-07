import { Effect, Runtime, type Scope } from 'effect';
import { copy } from '../../copy';
import { buildTarget } from '../../locator';
import type { EditRegistry } from '../edit';
import { isFigvalEvent, PICKER_YIELD_EVENT } from './figval-ui';
import { createOutlineBox } from './outline-box';
import type { OverlayHost } from './overlay-host';
import { down, hover, initialPickerState, up, type PickerState } from './picker-state';
import { makeFrameScheduler } from './raf';
import { TooltipPort } from './tooltip-port';

export interface PickerOptions {
  readonly doc: Document;
  readonly host: OverlayHost;
  readonly registry: EditRegistry;
  /** Called after a selection or cancel; the owner closes the picker's scope. */
  readonly onFinish?: () => void;
}

const kbd = (doc: Document, text: string): HTMLElement => {
  const node = doc.createElement('kbd');
  node.className = 'fv-kbd';
  node.textContent = text;
  return node;
};

const label = (doc: Document, text: string): HTMLElement => {
  const node = doc.createElement('span');
  node.textContent = text;
  return node;
};

const buildHint = (doc: Document): HTMLElement => {
  const hint = doc.createElement('div');
  hint.className = 'fv-ov-hint';
  hint.append(
    kbd(doc, copy.keys.escape),
    label(doc, copy.picker.hint.cancel),
    kbd(doc, `${copy.keys.up} ${copy.keys.down}`),
    label(doc, copy.picker.hint.parentChild),
  );
  return hint;
};

const asElement = (target: EventTarget | null): Element | null =>
  target !== null && (target as Node).nodeType === 1 ? (target as Element) : null;

/**
 * Capture-phase picker. Listeners exist only while the scope is open, so an inactive
 * picker never sees (let alone intercepts) a page click.
 */
export const startPicker = (
  options: PickerOptions,
): Effect.Effect<void, never, Scope.Scope | TooltipPort> =>
  Effect.gen(function* () {
    const port = yield* TooltipPort;
    const run = Runtime.runFork(yield* Effect.runtime<never>());
    const { doc, host, registry } = options;
    const win = doc.defaultView as Window;

    let state: PickerState = initialPickerState;
    const box = createOutlineBox(host.layer);
    const hint = buildHint(doc);
    host.layer.append(hint);
    const frame = makeFrameScheduler(win, () =>
      state.current ? box.show(state.current, state.selected) : box.hide(),
    );

    const finish = (): void => options.onFinish?.();
    const confirm = (el: Element): void => {
      const target = buildTarget(el);
      run(port.openTooltip(target, { mode: 'new', anchor: el, registry }));
      finish();
    };
    const swallow = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const set = (next: PickerState): void => {
      state = next;
      frame.schedule();
    };

    const onMove = (event: Event): void => {
      const el = asElement(event.target);
      if (!el || isFigvalEvent(event) || el === state.current) return;
      set(hover(state, el));
    };
    const onClick = (event: Event): void => {
      if (isFigvalEvent(event)) return;
      const el = state.selected ? state.current : asElement(event.target);
      swallow(event);
      if (el) confirm(el);
    };
    const onKey = (event: Event): void => {
      if (isFigvalEvent(event)) return;
      const key = (event as KeyboardEvent).key;
      if (key === 'Escape') return (swallow(event), finish());
      if (key === 'Enter' && state.current) return (swallow(event), confirm(state.current));
      if (key === 'ArrowUp') return (swallow(event), set(up(state)));
      if (key === 'ArrowDown') return (swallow(event), set(down(state)));
    };

    const onYield = (): void => finish();

    const redraw = (): void => frame.schedule();
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        doc.addEventListener('pointermove', onMove, true);
        doc.addEventListener('click', onClick, true);
        doc.addEventListener('keydown', onKey, true);
        doc.addEventListener(PICKER_YIELD_EVENT, onYield);
        win.addEventListener('scroll', redraw, true);
        win.addEventListener('resize', redraw);
      }),
      () =>
        Effect.sync(() => {
          doc.removeEventListener('pointermove', onMove, true);
          doc.removeEventListener('click', onClick, true);
          doc.removeEventListener('keydown', onKey, true);
          doc.removeEventListener(PICKER_YIELD_EVENT, onYield);
          win.removeEventListener('scroll', redraw, true);
          win.removeEventListener('resize', redraw);
          frame.cancel();
          box.remove();
          hint.remove();
        }),
    );
  });
