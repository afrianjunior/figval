import { copy, type ErrorTag } from '../../../copy';
import { Button, Kbd } from '../../../ui';
import type { TooltipState } from '../model/state';
import { canSave } from '../model/selectors';

const t = copy.tooltip;

const errorText = (tag: string): string =>
  tag in copy.errors ? copy.errors[tag as ErrorTag] : t.status.saveFailed;

export interface FooterProps {
  readonly state: TooltipState;
  readonly onCancel: () => void;
  readonly onSave: () => void;
  readonly isMac: boolean;
}

export function Footer({ state, onCancel, onSave, isMac }: FooterProps) {
  return (
    <footer className="fv-tip__foot">
      {state.error ? (
        <p role="alert" className="fv-tip__error">
          {errorText(state.error)}
        </p>
      ) : null}
      {state.escArmed ? (
        <p role="status" className="fv-tip__discard">
          {t.status.discardConfirm}
        </p>
      ) : null}
      <div className="fv-tip__actions">
        <Button variant="ghost" onClick={onCancel} kbd={<Kbd>{copy.keys.escape}</Kbd>}>
          {t.actions.cancel}
        </Button>
        <Button
          variant="primary"
          disabled={!canSave(state)}
          onClick={onSave}
          kbd={<Kbd>{isMac ? copy.keys.submit : copy.keys.submitOther}</Kbd>}
        >
          {t.actions.save}
        </Button>
      </div>
    </footer>
  );
}
