import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';

export interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const activeIn = (node: Node): Element | null => {
  const root = node.getRootNode() as Document | ShadowRoot;
  return root.activeElement ?? document.activeElement;
};

export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = panel.current;
    if (!open || !node) return;
    const opener = activeIn(node);
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const node = panel.current;
    if (!node) return;
    const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return event.preventDefault();
    const active = activeIn(node);
    if (event.shiftKey && (active === first || active === node)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fv-dialog__scrim" onKeyDown={onKeyDown}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('fv-dialog', className)}
      >
        <h2 id={titleId} className="fv-dialog__title">
          {title}
        </h2>
        <div className="fv-dialog__body">{children}</div>
        {footer ? <div className="fv-dialog__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
