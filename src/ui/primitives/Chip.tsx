import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  readonly pressed: boolean;
  readonly onPressedChange: (pressed: boolean) => void;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { pressed, onPressedChange, className, type = 'button', onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={cx('fv-chip', pressed && 'fv-chip--on', className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onPressedChange(!pressed);
      }}
      {...rest}
    />
  );
});
