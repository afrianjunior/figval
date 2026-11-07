import type { DomStep, Target } from '../../domain';
import { copy } from '../../copy';

const stepText = (step: DomStep): string =>
  step.tag +
  (step.id === undefined ? '' : `#${step.id}`) +
  step.classes.map((c) => `.${c}`).join('') +
  (step.nth === undefined ? '' : `:nth-child(${step.nth})`);

const parts = copy.panel.detail.locatorParts;

function LocatorBlock({ label, children }: { readonly label: string; readonly children: string }) {
  return (
    <div className="fvp-locator__part">
      <span className="fvp-locator__label">{label}</span>
      <pre className="fvp-code">{children}</pre>
    </div>
  );
}

/** DOM path, selector and HTML as plain text (never markup). */
export function Locator({ target, defaultOpen }: { readonly target: Target; readonly defaultOpen: boolean }) {
  return (
    <details className="fvp-locator" open={defaultOpen}>
      <summary className="fvp-locator__summary">{copy.panel.detail.locator}</summary>
      <div className="fvp-locator__body">
        {target.domPath.length === 0 ? null : (
          <LocatorBlock label={parts.domPath}>{target.domPath.map(stepText).join(' › ')}</LocatorBlock>
        )}
        <LocatorBlock label={parts.selector}>{target.selector}</LocatorBlock>
        <LocatorBlock label={parts.html}>{target.html}</LocatorBlock>
      </div>
    </details>
  );
}
