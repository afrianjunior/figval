import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx';
import { nudgeValue, parseNumber, scrubValue, clamp } from '../scrub';

export interface ScrubNumberProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** Accessible name of the input. */
  readonly label: string;
  /** Short visible drag handle: a letter, an icon node, or text such as "W". */
  readonly handle?: ReactNode;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

interface DragState {
  readonly startX: number;
  readonly startValue: number;
  readonly pointerId: number;
}

export function ScrubNumber({
  value,
  onChange,
  label,
  handle,
  min,
  max,
  step = 1,
  unit,
  disabled,
  className,
}: ScrubNumberProps) {
  const id = useId();
  const drag = useRef<DragState | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const range = { min, max };

  const commitDraft = () => {
    const parsed = draft === null ? null : parseNumber(draft);
    if (parsed !== null) onChange(clamp(parsed, range));
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') return commitDraft();
    if (event.key === 'Escape') return setDraft(null);
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const base = draft === null ? value : (parseNumber(draft) ?? value);
    onChange(nudgeValue(base, event.key === 'ArrowUp' ? 1 : -1, step, event.shiftKey, range));
    setDraft(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return;
    drag.current = { startX: event.clientX, startValue: value, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setScrubbing(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    if (!state) return;
    const next = scrubValue(
      state.startValue,
      event.clientX - state.startX,
      step,
      event.shiftKey,
      range,
    );
    if (next !== value) onChange(next);
  };

  const endDrag = (event: PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(state.pointerId)) {
      event.currentTarget.releasePointerCapture(state.pointerId);
    }
    setScrubbing(false);
  };

  return (
    <div
      className={cx(
        'fv-scrub',
        scrubbing && 'fv-scrub--active',
        disabled && 'fv-scrub--disabled',
        className,
      )}
    >
      {handle ? (
        <span
          className="fv-scrub__handle"
          aria-hidden="true"
          data-testid="scrub-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {handle}
        </span>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        disabled={disabled}
        className="fv-scrub__input fv-mono"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
      />
      {unit ? (
        <span className="fv-scrub__unit" aria-hidden="true">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
