import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Icon } from '../icons';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx('fv-iconbtn', className)}
      {...rest}
    >
      <Icon icon={icon} />
    </button>
  );
});
