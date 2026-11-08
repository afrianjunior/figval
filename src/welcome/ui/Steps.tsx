import { Check, ExternalLink, Keyboard, Pin, Puzzle } from 'lucide-react';
import type { ReactNode } from 'react';
import { copy } from '../../copy';
import type { Preset } from '../../domain';
import { Button, Icon, Kbd, cx } from '../../ui';
import { Logo } from './Logo';

const t = copy.welcome;

interface StepProps {
  readonly n: number;
  readonly title: string;
  readonly done?: boolean;
  readonly children: ReactNode;
}

/** One numbered card; the marker uses the note-pin shape and fills in when the step is done. */
export function Step({ n, title, done = false, children }: StepProps) {
  const headingId = `fvw-step-${n}`;
  return (
    <li className={cx('fvw-step', done && 'fvw-step--done')} aria-labelledby={headingId}>
      <span className="fvw-step__marker" aria-hidden="true">
        {done ? <Icon icon={Check} /> : n}
      </span>
      <div className="fvw-step__body">
        <h2 id={headingId} className="fvw-step__title">
          {title}
          {done ? <span className="fv-sr-only">{` (${t.stepDone})`}</span> : null}
        </h2>
        {children}
      </div>
    </li>
  );
}

/** A flat sketch of Chrome's toolbar: address bar, puzzle menu, Figval pinned or not. */
function ToolbarSketch({ pinned }: { readonly pinned: boolean }) {
  return (
    <div className="fvw-toolbar" aria-hidden="true">
      <span className="fvw-toolbar__omnibox" />
      {pinned ? (
        <span className="fvw-toolbar__icon fvw-toolbar__icon--figval">
          <Logo size={18} />
        </span>
      ) : null}
      <span className={cx('fvw-toolbar__icon', !pinned && 'fvw-toolbar__icon--cue')}>
        <Icon icon={Puzzle} />
      </span>
      {pinned ? null : (
        <span className="fvw-toolbar__menu">
          <Logo size={14} />
          <span className="fvw-toolbar__menu-name">Figval</span>
          <Icon icon={Pin} className="fvw-toolbar__pin" />
        </span>
      )}
    </div>
  );
}

export function PinStep({ pinned }: { readonly pinned: boolean }) {
  return (
    <Step n={1} title={t.pin.title} done={pinned}>
      <p className="fvw-text">{pinned ? t.pin.pinned : t.pin.body}</p>
      <ToolbarSketch pinned={pinned} />
    </Step>
  );
}

interface RoleStepProps {
  readonly preset: Preset;
  readonly chosen: boolean;
  readonly saveFailed: boolean;
  readonly onChoose: (preset: Preset) => void;
}

const PRESETS = ['reviewer', 'developer'] as const;

export function RoleStep({ preset, chosen, saveFailed, onChoose }: RoleStepProps) {
  return (
    <Step n={2} title={t.role.title} done={chosen}>
      <fieldset className="fvw-roles">
        <legend className="fv-sr-only">{t.role.legend}</legend>
        {PRESETS.map((value) => (
          <label key={value} className={cx('fvw-role', preset === value && 'fvw-role--on')}>
            <input
              type="radio"
              name="preset"
              value={value}
              className="fvw-role__input"
              checked={preset === value}
              onChange={() => onChoose(value)}
            />
            <span className="fvw-role__label">{t.role[value].label}</span>
            <span className="fvw-role__body">{t.role[value].body}</span>
          </label>
        ))}
      </fieldset>
      {saveFailed ? (
        <p role="alert" className="fvw-error">
          {t.role.saveFailed}
        </p>
      ) : (
        <p className="fvw-hint">{t.role.hint}</p>
      )}
    </Step>
  );
}

interface TryStepProps {
  readonly done: boolean;
  readonly shortcut: string;
  readonly onOpenExample: () => void;
  readonly onOpenShortcuts: () => void;
}

export function TryStep({ done, shortcut, onOpenExample, onOpenShortcuts }: TryStepProps) {
  return (
    <Step n={3} title={t.tryIt.title} done={done}>
      <p className="fvw-text">
        {t.tryIt.body} {shortcut === '' ? null : <Kbd>{shortcut}</Kbd>}
        {shortcut === '' ? '' : '.'}
      </p>
      {shortcut === '' ? (
        <p className="fvw-warn">
          <span>{t.tryIt.noShortcut}</span>
          <Button variant="ghost" size="sm" icon={Keyboard} onClick={onOpenShortcuts}>
            {t.tryIt.setShortcut}
          </Button>
        </p>
      ) : null}
      <p className="fvw-hint">{t.tryIt.sitePrompt}</p>
      <div className="fvw-actions">
        <Button variant="primary" size="md" icon={ExternalLink} onClick={onOpenExample}>
          {t.tryIt.openExample}
        </Button>
      </div>
    </Step>
  );
}
