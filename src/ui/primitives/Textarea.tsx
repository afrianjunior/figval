import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../cx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly autosize?: boolean;
  readonly maxHeight?: number;
}

const DEFAULT_MAX_HEIGHT = 200;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autosize, maxHeight = DEFAULT_MAX_HEIGHT, className, value, rows = 3, ...rest },
  forwarded,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof forwarded === 'function') forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    [forwarded],
  );

  useLayoutEffect(() => {
    const node = inner.current;
    if (!autosize || !node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
  }, [autosize, maxHeight, value]);

  return (
    <textarea
      ref={setRef}
      rows={rows}
      value={value}
      className={cx('fv-textarea', autosize && 'fv-textarea--auto', className)}
      {...rest}
    />
  );
});
