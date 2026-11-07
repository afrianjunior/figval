import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { icons } from '../icons';
import { IconButton } from './IconButton';

export interface PropertyRowProps {
  readonly label: string;
  readonly changed?: boolean;
  /** Screen-reader text for the changed dot. */
  readonly changedLabel?: string;
  readonly onReset?: () => void;
  readonly resetLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function PropertyRow({
  label,
  changed,
  changedLabel,
  onReset,
  resetLabel,
  children,
  className,
}: PropertyRowProps) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={cx('fv-prow', changed && 'fv-prow--changed', className)}
    >
      <span id={id} className="fv-prow__label">
        {changed ? <span className="fv-prow__dot" aria-hidden="true" /> : null}
        {label}
        {changed && changedLabel ? <span className="fv-sr-only"> ({changedLabel})</span> : null}
      </span>
      <div className="fv-prow__value">{children}</div>
      <span className="fv-prow__reset">
        {changed && onReset && resetLabel ? (
          <IconButton
            label={resetLabel}
            icon={icons.reset}
            onClick={onReset}
            className="fv-iconbtn--xs"
          />
        ) : null}
      </span>
    </div>
  );
}
