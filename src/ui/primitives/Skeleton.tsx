import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../cx';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  readonly width?: number | string;
  readonly height?: number | string;
}

export function Skeleton({
  width = '100%',
  height = 12,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const merged: CSSProperties = { width, height, ...style };
  return (
    <span aria-hidden="true" className={cx('fv-skeleton', className)} style={merged} {...rest} />
  );
}
