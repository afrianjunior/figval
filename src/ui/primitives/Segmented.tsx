import type { LucideIcon } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../cx';
import { Icon } from '../icons';

export interface SegmentOption<T extends string> {
  readonly value: T;
  /** Text segment. */
  readonly label?: string;
  /** Icon segment; `ariaLabel` then names it. */
  readonly icon?: LucideIcon;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly className?: string;
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];

const stepIndex = (from: number, dir: 1 | -1, enabled: readonly boolean[]): number => {
  const count = enabled.length;
  for (let i = 1; i <= count; i += 1) {
    const idx = (from + dir * i + count * i) % count;
    if (enabled[idx]) return idx;
  }
  return from;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);
  const enabled = options.map((o) => !o.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0;
    if (dir === 0) return;
    event.preventDefault();
    const next = stepIndex(Math.max(current, 0), dir, enabled);
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('fv-seg', className)}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const tabbable = checked || (current === -1 && index === 0);
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.icon ? (option.ariaLabel ?? option.label) : undefined}
            title={option.icon ? (option.ariaLabel ?? option.label) : undefined}
            tabIndex={tabbable ? 0 : -1}
            disabled={option.disabled}
            className={cx('fv-seg__item', checked && 'fv-seg__item--on')}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? <Icon icon={option.icon} /> : option.label}
          </button>
        );
      })}
    </div>
  );
}
