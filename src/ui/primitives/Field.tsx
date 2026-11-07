import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
}

export interface FieldProps {
  readonly label: string;
  readonly layout?: 'stacked' | 'inline';
  readonly hint?: string;
  readonly error?: string;
  readonly className?: string;
  readonly children: ReactNode | ((control: FieldControlProps) => ReactNode);
}

export function Field({ label, layout = 'stacked', hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  const control: FieldControlProps = {
    id,
    'aria-describedby': note ? noteId : undefined,
    'aria-invalid': error ? true : undefined,
  };
  return (
    <div className={cx('fv-field', `fv-field--${layout}`, className)}>
      <label className="fv-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="fv-field__control">
        {typeof children === 'function' ? children(control) : children}
      </div>
      {note ? (
        <p id={noteId} className={cx('fv-field__note', error && 'fv-field__note--error')}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { readonly mono?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, className, ...rest },
  ref,
) {
  return (
    <input ref={ref} className={cx('fv-input', mono && 'fv-input--mono', className)} {...rest} />
  );
});
