import { Check, X } from 'lucide-react';
import { copy } from '../../copy';
import { Icon, IconButton, cx } from '../../ui';
import type { ChecklistVm } from '../model';
import { usePanel } from './context';

const t = copy.panel.checklist;
const STEPS = ['picked', 'noted', 'exported'] as const;

/** First-run checklist above the list; progress comes from data, only "hide" is stored. */
export function Checklist({ checklist }: { readonly checklist: ChecklistVm | null }) {
  const { actions } = usePanel();
  if (checklist === null) return null;
  const done = STEPS.filter((key) => checklist[key]).length;
  return (
    <section className="fvp-check" aria-labelledby="fvp-check-title">
      <header className="fvp-check__head">
        <h2 id="fvp-check-title" className="fvp-check__title">
          {t.title}
        </h2>
        <span className="fvp-check__count">
          <span aria-hidden="true">{t.progress(done, STEPS.length)}</span>
          <span className="fv-sr-only">{t.progressLabel(done, STEPS.length)}</span>
        </span>
        <IconButton
          label={t.dismiss}
          icon={X}
          className="fvp-check__dismiss"
          onClick={() => void actions.updateSettings({ checklistDismissed: true })}
        />
      </header>
      <ol className="fvp-check__list">
        {STEPS.map((key) => (
          <li key={key} className={cx('fvp-check__item', checklist[key] && 'fvp-check__item--done')}>
            <span className="fvp-check__box" aria-hidden="true">
              {checklist[key] ? <Icon icon={Check} /> : null}
            </span>
            <span className="fvp-check__label">{t.steps[key]}</span>
            {checklist[key] ? <span className="fv-sr-only">{`, ${t.done}`}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
