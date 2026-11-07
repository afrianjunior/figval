import { useEffect, useRef, type KeyboardEvent } from 'react';
import { copy } from '../../../copy';
import { Button } from '../../../ui';
import type { Action, TooltipState } from '../model/state';
import type { Side } from '../position';
import { CommentTab } from './CommentTab';
import { EditTab } from './EditTab';
import { Footer } from './Footer';
import { Header } from './Header';
import { TabBar } from './TabBar';

const t = copy.tooltip;

export interface TooltipViewProps {
  readonly state: TooltipState;
  readonly dispatch: (action: Action) => void;
  readonly swatches: readonly string[];
  readonly selector: string;
  readonly offscreen: 'above' | 'below' | null;
  readonly side?: Side;
  readonly isMac?: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  /** Header close button: behaves like Esc. */
  readonly onRequestClose: () => void;
  readonly onTextActive: (active: boolean) => void;
  readonly onHoverSimilar: (hovering: boolean) => void;
  readonly onDragMove: (dx: number, dy: number) => void;
  readonly onDragEnd: () => void;
  readonly onResume: () => void;
  readonly onDiscardDraft: () => void;
  readonly onScrollToElement?: () => void;
}

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside the dialog; the shadow root's active element is checked via the event path. */
const trapTab = (e: KeyboardEvent<HTMLElement>): void => {
  if (e.key !== 'Tab') return;
  const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (n) => !n.closest('fieldset:disabled'),
  );
  const first = nodes[0];
  const last = nodes.at(-1);
  if (!first || !last) return;
  const active = e.nativeEvent.composedPath()[0];
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
};

export function TooltipView(props: TooltipViewProps) {
  const { state, dispatch, offscreen } = props;
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const gone = state.elementStatus === 'gone';
  useEffect(() => commentRef.current?.focus(), []);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    trapTab(e);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      props.onSave();
    }
  };

  return (
    <>
      <span className="fv-tip__notch" data-side={props.side ?? 'dock'} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={t.header.provisionalId(state.seq)}
        className="fv-tip"
        data-side={props.side}
        onKeyDown={onKeyDown}
      >
        <Header
          seq={state.seq}
          label={state.label}
          onLabel={(value) => dispatch({ type: 'label', value })}
          onClose={props.onRequestClose}
          onDragMove={props.onDragMove}
          onDragEnd={props.onDragEnd}
        />
        {state.resume ? (
          <div className="fv-tip__resume" role="status">
            <span>{t.draft.resume(t.header.provisionalId(state.resume.seq))}</span>
            <Button variant="ghost" onClick={props.onResume}>
              {t.draft.resumeAction}
            </Button>
            <Button variant="ghost" onClick={props.onDiscardDraft}>
              {t.draft.discardAction}
            </Button>
          </div>
        ) : null}
        <TabBar
          tab={gone ? 'comment' : state.tab}
          editDisabled={gone}
          onChange={(value) => dispatch({ type: 'tab', value })}
        />
        {offscreen ? (
          <Button variant="ghost" className="fv-tip__offscreen" onClick={props.onScrollToElement}>
            {offscreen === 'above' ? t.scroll.above : t.scroll.below}
          </Button>
        ) : null}
        {gone ? (
          <p role="status" className="fv-tip__note fv-tip__note--warn">
            {t.status.elementGone}
          </p>
        ) : null}
        {state.elementStatus === 'reapplied' ? (
          <p role="status" className="fv-tip__note">
            {t.status.reapplied}
          </p>
        ) : null}
        <div
          role="tabpanel"
          id="fv-tip-panel"
          aria-labelledby={`fv-tip-tab-${state.tab}`}
          className="fv-tip__body"
        >
          {state.tab === 'comment' || gone ? (
            <CommentTab state={state} dispatch={dispatch} commentRef={commentRef} />
          ) : (
            <EditTab
              state={state}
              dispatch={dispatch}
              swatches={props.swatches}
              selector={props.selector}
              onTextActive={props.onTextActive}
              onHoverSimilar={props.onHoverSimilar}
            />
          )}
        </div>
        <Footer
          state={state}
          onCancel={props.onCancel}
          onSave={props.onSave}
          isMac={props.isMac ?? false}
        />
      </div>
    </>
  );
}
