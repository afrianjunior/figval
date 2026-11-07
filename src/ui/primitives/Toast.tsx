import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import { icons } from '../icons';
import { IconButton } from './IconButton';

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  readonly message: ReactNode;
  readonly action?: ReactNode;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
}

export function Toast({ message, action, onClose, closeLabel, className, ...rest }: ToastProps) {
  return (
    <div role="status" className={cx('fv-toast', className)} {...rest}>
      <span className="fv-toast__msg">{message}</span>
      {action ? <span className="fv-toast__action">{action}</span> : null}
      {onClose && closeLabel ? (
        <IconButton
          label={closeLabel}
          icon={icons.close}
          onClick={onClose}
          className="fv-iconbtn--xs"
        />
      ) : null}
    </div>
  );
}
