import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

export interface SwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  readonly color: string;
  /** Accessible name, usually the hex value. */
  readonly label: string;
  readonly selected?: boolean;
  readonly size?: 'sm' | 'md';
}

export const Swatch = forwardRef<HTMLButtonElement, SwatchProps>(function Swatch(
  { color, label, selected, size = 'md', className, type = 'button', onClick, ...rest },
  ref,
) {
  const classes = cx('fv-swatch', `fv-swatch--${size}`, selected && 'fv-swatch--on', className);
  const style = { '--fv-swatch': color } as React.CSSProperties;
  if (!onClick) {
    return <span role="img" aria-label={label} className={classes} style={style} />;
  }
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      className={classes}
      style={style}
      onClick={onClick}
      {...rest}
    />
  );
});
