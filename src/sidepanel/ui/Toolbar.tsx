import { copy } from '../../copy';
import { Button, Segmented, icons } from '../../ui';
import type { Shell } from '../model';
import { usePanel } from './context';
import { isMac } from './hooks';

const t = copy.panel.toolbar;

const RETRY_HELPERS: ReadonlySet<string> = new Set(['permissionDeclined', 'injectionFailed']);

export function UnsupportedNote() {
  return (
    <p className="fvp-note" role="status">
      {copy.panel.states.unsupported.line}
    </p>
  );
}

export function Toolbar({ shell }: { readonly shell: Shell }) {
  const { actions } = usePanel();
  const { toolbar, errors } = shell;
  if (toolbar.helperKey === 'unsupported') {
    return (
      <div className="fvp-toolbar">
        <UnsupportedNote />
      </div>
    );
  }
  const errorTag = errors.pick ?? errors.showNotes;
  const canRetry = RETRY_HELPERS.has(toolbar.helperKey) || errorTag !== undefined;
  return (
    <div className="fvp-toolbar">
      <div className="fvp-toolbar__row">
        <Button
          variant="primary"
          icon={icons.pick}
          kbd={isMac() ? copy.keys.toggleShortcut : copy.keys.toggleShortcutOther}
          disabled={toolbar.pickDisabled}
          onClick={() => void actions.pick()}
        >
          {t.pick}
        </Button>
        <Segmented
          label={t.toggleLabel}
          value={toolbar.beforeAfter}
          onChange={(v) => void actions.setBeforeAfter(v)}
          options={[
            { value: 'before', label: t.before },
            { value: 'after', label: t.after },
          ]}
        />
      </div>
      <p className="fvp-toolbar__helper">{t.helper[toolbar.helperKey]}</p>
      {errorTag === undefined ? null : (
        <p role="alert" className="fvp-error">
          {copy.errors[errorTag]}
        </p>
      )}
      {canRetry ? (
        <Button variant="ghost" onClick={() => void actions.pick()}>
          {t.retry}
        </Button>
      ) : null}
    </div>
  );
}
