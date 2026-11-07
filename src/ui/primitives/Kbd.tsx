import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cx('fv-kbd', className)} {...rest} />;
}
