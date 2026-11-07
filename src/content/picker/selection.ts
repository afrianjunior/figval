import { Effect, Runtime, type Scope } from 'effect';
import { copy } from '../../copy';
import { buildTarget, nearestBlock } from '../../locator';
import type { EditRegistry } from '../edit';
import type { OverlayHost } from './overlay-host';
import { isFigvalEvent, PICKER_YIELD_EVENT } from './figval-ui';
import { makeFrameScheduler } from './raf';
import { TooltipPort } from './tooltip-port';

export interface SelectionOptions {
  readonly doc: Document;
  readonly host: OverlayHost;
  readonly registry: EditRegistry;
}

const GAP = 8;
const BUTTON_WIDTH = 64;

interface Pending {
  readonly range: Range;
  readonly text: string;
}

const endRect = (range: Range): { x: number; y: number } => {
  const rects = range.getClientRects();
  const last = rects.length > 0 ? rects[rects.length - 1] : undefined;
  const rect = last ?? range.getBoundingClientRect();
  return { x: rect.right, y: rect.bottom };
};

/** Reads the live selection; null when empty, collapsed, or inside Figval's own UI. */
const readSelection = (doc: Document, host: OverlayHost): Pending | null => {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const text = sel.toString();
  if (text.trim() === '') return null;
  const range = sel.getRangeAt(0).cloneRange();
  const anchor = range.commonAncestorContainer;
  if (host.host.contains(anchor) || anchor.getRootNode() === host.root) return null;
  return { range, text };
};

/** "+ Note" button near the selection end. Only runs while its scope is open (i.e. after activation). */
export const startSelection = (
  options: SelectionOptions,
): Effect.Effect<void, never, Scope.Scope | TooltipPort> =>
  Effect.gen(function* () {
    const port = yield* TooltipPort;
    const run = Runtime.runFork(yield* Effect.runtime<never>());
    const { doc, host, registry } = options;
    const win = doc.defaultView as Window;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'fv-btn fv-btn--primary fv-btn--sm fv-ov-addnote';
    button.textContent = copy.picker.addNote;
    button.hidden = true;
    host.layer.append(button);

    let pending: Pending | null = null;
    const update = (): void => {
      pending = readSelection(doc, host);
      if (!pending) {
        button.hidden = true;
        return;
      }
      const { x, y } = endRect(pending.range);
      const left = Math.max(GAP, Math.min(x, win.innerWidth - BUTTON_WIDTH - GAP));
      button.style.transform = `translate(${left}px, ${y + GAP}px)`;
      button.hidden = false;
    };
    const frame = makeFrameScheduler(win, update);

    const onSelectionChange = (): void => frame.schedule();
    const onMouseUp = (event: Event): void => {
      if (isFigvalEvent(event)) return;
      frame.schedule();
    };
    const keepSelection = (event: Event): void => event.preventDefault();
    const onClick = (): void => {
      const current = pending ?? readSelection(doc, host);
      if (!current) return;
      const block = nearestBlock(current.range.commonAncestorContainer);
      const target = buildTarget(block, current.range);
      run(
        port.openTooltip(target, {
          mode: 'new',
          anchor: block,
          selectionText: current.text,
          registry,
        }),
      );
      doc.dispatchEvent(new CustomEvent(PICKER_YIELD_EVENT));
      doc.getSelection()?.removeAllRanges();
      button.hidden = true;
    };

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        doc.addEventListener('selectionchange', onSelectionChange);
        doc.addEventListener('mouseup', onMouseUp, true);
        button.addEventListener('mousedown', keepSelection);
        button.addEventListener('click', onClick);
      }),
      () =>
        Effect.sync(() => {
          doc.removeEventListener('selectionchange', onSelectionChange);
          doc.removeEventListener('mouseup', onMouseUp, true);
          frame.cancel();
          button.remove();
        }),
    );
  });
