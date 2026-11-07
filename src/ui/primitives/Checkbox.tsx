import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label. Omit only when an `aria-label` is passed (e.g. a list row slot). */
  readonly label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cx('fv-check', className)}>
      <input ref={ref} type="checkbox" className="fv-check__box" {...rest} />
      {label ? <span className="fv-check__label">{label}</span> : null}
    </label>
  );
});
