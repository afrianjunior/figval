import { useRef, type PointerEvent } from 'react';
import { copy } from '../../../copy';
import { icons, IconButton, Input } from '../../../ui';

const t = copy.tooltip;
/** Header areas that handle their own pointer events and must not start a drag. */
const INTERACTIVE = 'input, button, textarea, select, a';

export interface HeaderProps {
  readonly seq: number;
  readonly label: string;
  readonly onLabel: (value: string) => void;
  readonly onClose: () => void;
  readonly onDragMove: (dx: number, dy: number) => void;
  readonly onDragEnd: () => void;
}

interface Origin {
  readonly x: number;
  readonly y: number;
  readonly id: number;
}

export function Header({ seq, label, onLabel, onClose, onDragMove, onDragEnd }: HeaderProps) {
  const origin = useRef<Origin | null>(null);

  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const o = origin.current;
    if (o) onDragMove(e.clientX - o.x, e.clientY - o.y);
  };
  const up = (e: PointerEvent<HTMLElement>) => {
    const o = origin.current;
    if (!o) return;
    origin.current = null;
    if (e.currentTarget.hasPointerCapture?.(o.id)) e.currentTarget.releasePointerCapture(o.id);
    onDragEnd();
  };

  return (
    <header
      className="fv-tip__head"
      data-testid="tooltip-header"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span className="fv-tip__seq fv-mono">{t.header.provisionalId(seq)}</span>
      <Input
        className="fv-tip__label"
        aria-label={t.header.labelPlaceholder}
        placeholder={t.header.labelPlaceholder}
        value={label}
        onChange={(e) => onLabel(e.target.value)}
      />
      <IconButton label={t.header.close} icon={icons.close} onClick={onClose} />
    </header>
  );
}
