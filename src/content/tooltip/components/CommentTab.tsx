import { copy } from '../../../copy';
import { Button, Checkbox, Textarea } from '../../../ui';
import type { Action, TooltipState } from '../model/state';
import { showForceApply } from '../model/selectors';

const t = copy.tooltip;

export interface CommentTabProps {
  readonly state: TooltipState;
  readonly dispatch: (action: Action) => void;
  readonly commentRef?: React.Ref<HTMLTextAreaElement>;
}

export function CommentTab({ state, dispatch, commentRef }: CommentTabProps) {
  return (
    <div className="fv-tip__pane">
      {state.selectionText ? (
        <blockquote className="fv-tip__quote" aria-label={t.selection.quoteLabel}>
          {state.selectionText}
        </blockquote>
      ) : null}
      <Textarea
        ref={commentRef}
        autosize
        rows={3}
        aria-label={t.comment.placeholder}
        placeholder={t.comment.placeholder}
        value={state.comment}
        onChange={(e) => dispatch({ type: 'comment', value: e.target.value })}
      />
      {state.showWhy ? (
        <Textarea
          autosize
          rows={2}
          aria-label={t.comment.reasonPlaceholder}
          placeholder={t.comment.reasonPlaceholder}
          value={state.why}
          onChange={(e) => dispatch({ type: 'why', value: e.target.value })}
        />
      ) : (
        <Button
          variant="ghost"
          className="fv-tip__why"
          onClick={() => dispatch({ type: 'showWhy' })}
        >
          {t.comment.addReason}
        </Button>
      )}
      {showForceApply(state) ? (
        <Checkbox
          label={t.comment.forceApply}
          checked={state.forceApply}
          onChange={(e) => dispatch({ type: 'forceApply', value: e.target.checked })}
        />
      ) : null}
    </div>
  );
}
