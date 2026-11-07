import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cx } from '../cx';

export interface SliderProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'min' | 'max'
> {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  /** Accessible name; required because the slider has no visible label of its own. */
  readonly label: string;
  readonly unit?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { value, min, max, step = 1, onChange, label, unit, className, ...rest },
  ref,
) {
  const span = max - min;
  const fill = span > 0 ? ((value - min) / span) * 100 : 0;
  return (
    <span className={cx('fv-slider', className)}>
      <input
        ref={ref}
        type="range"
        aria-label={label}
        aria-valuetext={unit ? `${value}${unit}` : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fv-fill': `${fill}%` } as React.CSSProperties}
        className="fv-slider__input"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        {...rest}
      />
      <span className="fv-slider__value fv-mono" aria-hidden="true">
        {value}
        {unit}
      </span>
    </span>
  );
});
