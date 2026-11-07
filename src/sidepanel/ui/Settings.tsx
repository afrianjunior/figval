import { copy } from '../../copy';
import { Checkbox, Field, IconButton, Segmented, icons } from '../../ui';
import type { PanelState } from '../model';
import { usePanel } from './context';
import { useHeadingFocus } from './hooks';

const t = copy.panel.settings;
type SettingsState = Extract<PanelState, { readonly _tag: 'Settings' }>;

export function Settings({ panel }: { readonly panel: SettingsState }) {
  const { actions } = usePanel();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const { settings, corruptCount } = panel;
  const errorTag = panel.shell.errors.settings;
  return (
    <section className="fvp-sub" aria-labelledby="fvp-settings-title">
      <header className="fvp-sub__head">
        <IconButton label={copy.panel.detail.back} icon={icons.back} onClick={() => void actions.back()} />
        <h2 id="fvp-settings-title" ref={heading} tabIndex={-1} className="fvp-sub__title">
          {t.title}
        </h2>
      </header>
      <div className="fvp-scroll fvp-sub__body">
        <Field label={t.preset}>
          <Segmented
            label={t.preset}
            value={settings.preset}
            onChange={(preset) => void actions.updateSettings({ preset })}
            options={[
              { value: 'developer', label: t.presets.developer },
              { value: 'reviewer', label: t.presets.reviewer },
            ]}
          />
        </Field>
        <Checkbox
          label={t.screenshots}
          checked={settings.screenshots}
          onChange={(e) => void actions.updateSettings({ screenshots: e.target.checked })}
        />
        {errorTag === undefined ? null : (
          <p role="alert" className="fvp-error">
            {copy.errors[errorTag]}
          </p>
        )}
        {corruptCount > 0 ? (
          <p className="fvp-note" role="status">
            {t.corrupt(corruptCount)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
