import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface PinProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pin text, e.g. the note tag. */
  readonly children: ReactNode;
  /** Comment preview shown on hover and focus. */
  readonly preview?: ReactNode;
  readonly active?: boolean;
}

export const Pin = forwardRef<HTMLButtonElement, PinProps>(function Pin(
  { children, preview, active, className, type = 'button', ...rest },
  ref,
) {
  const previewId = useId();
  return (
    <span className={cx('fv-pin', active && 'fv-pin--active', className)}>
      <button ref={ref} type={type} className="fv-pin__btn fv-mono"
        aria-describedby={preview ? previewId : undefined}
        {...rest}
      >
        {children}
      </button>
      {preview ? (
        <span role="tooltip" id={previewId} className="fv-pin__preview">
          {preview}
        </span>
      ) : null}
    </span>
  );
});
