import { Effect } from 'effect';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { OverlayHost } from '../picker';
import { pageSwatches } from '../edit';
import type { Actions } from './actions';
import { TooltipView, type TooltipViewProps } from './components/TooltipView';
import { clearDraft } from './drafts';
import type { Follower } from './follow';
import type { SessionCtx } from './session';
import tooltipCss from './tooltip.css?inline';

export interface View {
  readonly slot: HTMLElement;
  readonly render: (sync?: boolean) => void;
  readonly setPlacement: (
    side: TooltipViewProps['side'],
    offscreen: 'above' | 'below' | null,
  ) => void;
  readonly attach: (follower: Follower) => void;
  readonly unmount: () => void;
}

const isMac = (): boolean => /mac/i.test(globalThis.navigator?.platform ?? '');

/** Mounts the React tooltip into the overlay's shadow root and re-renders it from the store. */
export const mountView = (ctx: SessionCtx, host: OverlayHost, actions: Actions): View => {
  const { doc, store, target, previewer, matches, textRow, deps } = ctx;
  const slot = doc.createElement('div');
  slot.className = 'fv-tip-slot';
  const style = doc.createElement('style');
  style.textContent = tooltipCss;
  host.root.append(style);
  host.layer.append(slot);
  const root = createRoot(slot);
  const swatches = pageSwatches(doc);
  const placement = {
    side: undefined as TooltipViewProps['side'],
    offscreen: null as 'above' | 'below' | null,
  };
  let follower: Follower | null = null;

  const onTextActive = (active: boolean): void => {
    previewer.setTextActive(active);
    if (!active) {
      Effect.runFork(textRow.deactivate);
      return previewer.apply(store.get());
    }
    if (!store.get().baseline.hasEditableText) return;
    const onText = (value: string): void =>
      store.dispatch({
        type: 'text',
        value: value === store.get().baseline.text ? null : value,
      });
    Effect.runFork(textRow.activate(ctx.ref.el, onText));
  };

  const element = (): React.JSX.Element => {
    const s = store.get();
    const selector = s.controls.similarSelector ?? target.selector;
    return (
      <TooltipView
        state={s}
        dispatch={store.dispatch}
        swatches={swatches}
        selector={selector}
        offscreen={placement.offscreen}
        side={placement.side}
        isMac={isMac()}
        onSave={actions.startSave}
        onCancel={() => Effect.runFork(actions.cancel)}
        onRequestClose={actions.requestClose}
        onTextActive={onTextActive}
        onHoverSimilar={(on) => (on ? matches.show(selector) : matches.hide())}
        onDragMove={(dx, dy) => follower?.dragMove(dx, dy)}
        onDragEnd={() => follower?.dragEnd()}
        onResume={() => {
          const pending = store.get().resume;
          if (pending) store.dispatch({ type: 'hydrate', snapshot: pending.snapshot });
        }}
        onDiscardDraft={() => {
          store.dispatch({ type: 'dismissResume' });
          Effect.runFork(clearDraft(deps.sessionStore, ctx.draftKey));
        }}
        onScrollToElement={() => ctx.ref.el.scrollIntoView?.({ block: 'center' })}
      />
    );
  };

  return {
    slot,
    render: (sync = false) => {
      if (ctx.flags.closed) return;
      if (sync) flushSync(() => root.render(element()));
      else root.render(element());
    },
    setPlacement: (side, offscreen) => {
      placement.side = side;
      placement.offscreen = offscreen;
    },
    attach: (next) => {
      follower = next;
    },
    unmount: () => root.unmount(),
  };
};
