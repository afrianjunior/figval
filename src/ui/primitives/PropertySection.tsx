import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { icons } from '../icons';
import { IconButton } from './IconButton';

export interface PropertySectionProps {
  readonly title: string;
  readonly hasChanges?: boolean;
  readonly onReset?: () => void;
  readonly resetLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function PropertySection({
  title,
  hasChanges,
  onReset,
  resetLabel,
  children,
  className,
}: PropertySectionProps) {
  const id = useId();
  const showReset = Boolean(hasChanges && onReset && resetLabel);
  return (
    <section aria-labelledby={id} className={cx('fv-section', className)}>
      <header className="fv-section__head">
        <h3 id={id} className="fv-section__title">
          {title}
        </h3>
        {showReset ? (
          <IconButton label={resetLabel ?? ''} icon={icons.reset} onClick={onReset} />
        ) : null}
      </header>
      <div className="fv-section__body">{children}</div>
    </section>
  );
}
