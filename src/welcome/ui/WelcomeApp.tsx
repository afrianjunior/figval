import { useEffect, useSyncExternalStore } from 'react';
import { copy } from '../../copy';
import { stepsOf, type WelcomeStore } from '../model';
import { Logo } from './Logo';
import { PinStep, RoleStep, TryStep } from './Steps';

const t = copy.welcome;
const TOTAL_STEPS = 3;

/** Container: owns the store subscription; the steps stay presentational. */
export function WelcomeApp({ store }: { readonly store: WelcomeStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const steps = stepsOf(state);

  useEffect(() => {
    document.title = t.pageTitle;
  }, []);

  return (
    <main className="fv-root fvw" aria-busy={!state.loaded}>
      <header className="fvw-intro">
        <Logo size={64} />
        <p className="fvw-eyebrow">{t.eyebrow}</p>
        <h1 className="fvw-title">{t.title}</h1>
        <p className="fvw-lede">{t.lede}</p>
        <p className="fvw-privacy">{t.privacy}</p>
      </header>
      <section className="fvw-steps" aria-label={t.pageTitle}>
        <div className="fvw-progress">
          <span className="fvw-progress__label" aria-live="polite">
            {t.progress(steps.done, TOTAL_STEPS)}
          </span>
          <span className="fvw-progress__bar" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={i < steps.done ? 'fvw-progress__seg fvw-progress__seg--on' : 'fvw-progress__seg'} />
            ))}
          </span>
        </div>
        <ol className="fvw-list">
          <PinStep pinned={state.pinned} />
          <RoleStep
            preset={state.preset}
            chosen={state.presetChosen}
            saveFailed={state.saveFailed}
            onChoose={(p) => void store.actions.choosePreset(p)}
          />
          <TryStep
            done={steps.tried}
            shortcut={state.shortcut}
            onOpenExample={() => void store.actions.openExample()}
            onOpenShortcuts={() => void store.actions.openShortcuts()}
          />
        </ol>
      </section>
    </main>
  );
}
