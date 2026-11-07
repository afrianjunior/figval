import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, IconButton, cx, icons } from '../../ui';
import { FOCUS_KEY } from './hooks';

export interface MenuItem {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface MenuProps {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly focusKey?: string;
}

/** ⋯ button with a popup list: Arrow keys move, Esc closes and returns focus to the button. */
export function Menu({ label, items, focusKey }: MenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const away = (event: PointerEvent) => {
      const node = list.current;
      if (node && event.target instanceof Node && !node.contains(event.target) && !trigger.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      nodes[(at + step + nodes.length) % nodes.length]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const focusProps = focusKey === undefined ? {} : { [FOCUS_KEY]: focusKey };
  return (
    <div className="fvp-menu">
      <IconButton
        ref={trigger}
        label={label}
        icon={icons.more}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        {...focusProps}
      />
      {open ? (
        <div ref={list} id={menuId} role="menu" aria-label={label} className="fvp-menu__list" onKeyDown={onKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cx('fvp-menu__item', item.danger && 'fvp-menu__item--danger')}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.icon ? <Icon icon={item.icon} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
