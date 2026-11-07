import { copy } from '../../copy';
import { Button } from '../../ui';
import { Strip as StripVm } from '../model';
import { usePanel } from './context';

const t = copy.panel.states;

/** "3 notes on this page · Show" / "3 notes in 'X' · Open". */
export function StripBar({ strip }: { readonly strip: StripVm }) {
  const { actions } = usePanel();
  return (
    <div className="fvp-strip">
      {StripVm.$match(strip, {
        NotActivated: ({ count }) => (
          <>
            <span className="fvp-strip__text">{t.notActivated.strip(count)}</span>
            <Button size="sm" onClick={() => void actions.showNotes()}>
              {t.notActivated.action}
            </Button>
          </>
        ),
        OtherSession: ({ count, sessionName, sessionId }) => (
          <>
            <span className="fvp-strip__text">{t.otherSession.strip(count, sessionName)}</span>
            <Button size="sm" onClick={() => void actions.activateSession(sessionId)}>
              {t.otherSession.action}
            </Button>
          </>
        ),
      })}
    </div>
  );
}
