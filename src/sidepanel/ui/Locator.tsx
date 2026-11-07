import type { DomStep, Target } from '../../domain';
import { copy } from '../../copy';

const stepText = (step: DomStep): string =>
  step.tag +
  (step.id === undefined ? '' : `#${step.id}`) +
  step.classes.map((c) => `.${c}`).join('') +
  (step.nth === undefined ? '' : `:nth-child(${step.nth})`);

/** DOM path, selector and HTML as plain text (never markup). */
export function Locator({ target, defaultOpen }: { readonly target: Target; readonly defaultOpen: boolean }) {
  return (
    <details className="fvp-locator" open={defaultOpen}>
      <summary className="fvp-locator__summary">{copy.panel.detail.locator}</summary>
      <div className="fvp-locator__body">
        {target.domPath.length === 0 ? null : (
          <pre className="fvp-code">{target.domPath.map(stepText).join(' › ')}</pre>
        )}
        <pre className="fvp-code">{target.selector}</pre>
        <pre className="fvp-code">{target.html}</pre>
      </div>
    </details>
  );
}
