import type { KeyboardEvent } from 'react';
import type { TooltipTab } from '../../../domain';
import { copy } from '../../../copy';
import { cx } from '../../../ui';

const t = copy.tooltip.tabs;
const ORDER: readonly TooltipTab[] = ['comment', 'edit'];

export interface TabBarProps {
  readonly tab: TooltipTab;
  readonly editDisabled: boolean;
  readonly onChange: (tab: TooltipTab) => void;
}

export function TabBar({ tab, editDisabled, onChange }: TabBarProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = ORDER[(ORDER.indexOf(tab) + 1) % ORDER.length];
    if (next && !(next === 'edit' && editDisabled)) onChange(next);
  };
  return (
    <div role="tablist" className="fv-tip__tabs" onKeyDown={onKeyDown}>
      {ORDER.map((value) => {
        const selected = value === tab;
        const disabled = value === 'edit' && editDisabled;
        return (
          <button
            key={value}
            id={`fv-tip-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="fv-tip-panel"
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={cx('fv-tip__tab', selected && 'fv-tip__tab--on')}
            onClick={() => onChange(value)}
          >
            {t[value]}
          </button>
        );
      })}
    </div>
  );
}
