import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Icon, icons } from '../icons';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value' | 'children'
> {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, value, onChange, className, ...rest },
  ref,
) {
  return (
    <span className={cx('fv-select', className)}>
      <select
        ref={ref}
        className="fv-select__native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon icon={icons.chevronDown} className="fv-select__chevron" />
    </span>
  );
});
