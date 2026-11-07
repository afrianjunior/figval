import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: LucideIcon;
  readonly kbd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', icon, kbd, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('fv-btn', `fv-btn--${variant}`, `fv-btn--${size}`, className)}
      {...rest}
    >
      {icon ? <Icon icon={icon} /> : null}
      <span className="fv-btn__label">{children}</span>
      {kbd ? <span className="fv-btn__kbd">{kbd}</span> : null}
    </button>
  );
});
