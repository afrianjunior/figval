import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

export type BadgeTone = 'apply' | 'propose' | 'missing' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('fv-badge', `fv-badge--${tone}`, className)} {...rest} />;
}
