import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, icons } from '../icons';

export interface LayerRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'title' | 'onSelect'> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Muted secondary info on the right. */
  readonly meta?: ReactNode;
  /** Checkbox slot, left of the title. */
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly selected?: boolean;
  readonly draggable?: boolean;
  readonly onSelect?: () => void;
}

export function LayerRow({
  title,
  description,
  meta,
  leading,
  trailing,
  selected,
  draggable,
  onSelect,
  className,
  ...rest
}: LayerRowProps) {
  return (
    <li
      className={cx(
        'fv-layer',
        selected && 'fv-layer--selected',
        draggable && 'fv-layer--drag',
        className,
      )}
      {...rest}
    >
      {draggable ? <Icon icon={icons.grip} className="fv-layer__grip" /> : null}
      {leading ? <span className="fv-layer__leading">{leading}</span> : null}
      <button
        type="button"
        className="fv-layer__main"
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className="fv-layer__title">{title}</span>
        {description ? <span className="fv-layer__desc">{description}</span> : null}
      </button>
      {meta ? <span className="fv-layer__meta">{meta}</span> : null}
      {trailing ? <span className="fv-layer__trailing">{trailing}</span> : null}
    </li>
  );
}
