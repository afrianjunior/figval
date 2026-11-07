import { copy } from '../../../copy';
import { Segmented } from '../../../ui';
import type { Action, TooltipState } from '../model/state';

const t = copy.tooltip.edit.scope;

export interface ScopeRowProps {
  readonly state: TooltipState;
  readonly dispatch: (action: Action) => void;
  /** True while the pointer or focus is on the "All similar" option. */
  readonly onHoverSimilar: (hovering: boolean) => void;
}

export function ScopeRow({ state, dispatch, onHoverSimilar }: ScopeRowProps) {
  const { similarCount, scope } = state.controls;
  return (
    <div
      className="fv-tip__scope"
      onPointerOver={(e) =>
        onHoverSimilar((e.target as Element).closest('[role="radio"]:last-child') !== null)
      }
      onPointerLeave={() => onHoverSimilar(false)}
      onFocus={(e) => onHoverSimilar(e.target.matches('[role="radio"]:last-child'))}
      onBlur={() => onHoverSimilar(false)}
    >
      <span className="fv-tip__scope-label">{t.label}</span>
      <Segmented
        label={t.label}
        value={scope}
        onChange={(value) => dispatch({ type: 'scope', value })}
        options={[
          { value: 'this', label: t.onlyThis },
          { value: 'similar', label: t.allSimilar(similarCount), disabled: similarCount < 2 },
        ]}
      />
    </div>
  );
}
