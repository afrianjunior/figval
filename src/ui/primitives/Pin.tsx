import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx';

export interface PinProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pin text, e.g. the note tag. */
  readonly children: ReactNode;
  /** Comment preview shown on hover and focus. */
  readonly preview?: ReactNode;
  readonly active?: boolean;
}

export const Pin = forwardRef<HTMLButtonElement, PinProps>(function Pin(
  { children, preview, active, className, type = 'button', onKeyDown, onBlur, ...rest },
  ref,
) {
  const previewId = useId();
  // Esc hides the preview until pointer leave or blur (WCAG 1.4.13 dismissable).
  const [dismissed, setDismissed] = useState(false);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    onKeyDown?.(event);
    if (event.key === 'Escape' && preview) setDismissed(true);
  };
  return (
    <span
      className={cx('fv-pin', active && 'fv-pin--active', className)}
      data-dismissed={dismissed ? '' : undefined}
      onPointerLeave={() => setDismissed(false)}
    >
      <button ref={ref} type={type} className="fv-pin__btn fv-mono"
        aria-describedby={preview ? previewId : undefined}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setDismissed(false);
          onBlur?.(event);
        }}
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
