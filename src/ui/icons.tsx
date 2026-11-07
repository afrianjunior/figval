import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  GripVertical,
  Image,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';
import { cx } from './cx';

export const ICON_SIZE = 16;
export const ICON_STROKE = 1.5;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  readonly icon: LucideIcon;
}

export function Icon({ icon: Glyph, className, ...rest }: IconProps) {
  return (
    <Glyph
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE}
      aria-hidden="true"
      focusable="false"
      className={cx('fv-icon', className)}
      {...rest}
    />
  );
}

/** Relevance: pick=Crosshair (aim at an element), comment=MessageSquare, edit=Pencil, hide=EyeOff, reset=RotateCcw. */
export const icons = {
  alignCenter: AlignCenter,
  alignLeft: AlignLeft,
  alignRight: AlignRight,
  back: ArrowLeft,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  close: X,
  comment: MessageSquare,
  copy: Copy,
  delete: Trash2,
  download: Download,
  edit: Pencil,
  grip: GripVertical,
  hide: EyeOff,
  image: Image,
  minus: Minus,
  more: Ellipsis,
  pick: Crosshair,
  plus: Plus,
  reset: RotateCcw,
  search: Search,
  show: Eye,
  text: Type,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
