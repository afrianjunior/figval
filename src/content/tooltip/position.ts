export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface Size {
  readonly w: number;
  readonly h: number;
}
export type Side = 'right' | 'left' | 'below' | 'above' | 'dock';

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly side: Side;
  /** Direction of the anchor when it is scrolled out of the viewport. */
  readonly offscreen: 'above' | 'below' | null;
}

export interface PlaceInput {
  readonly anchor: Box;
  readonly size: Size;
  readonly viewport: Size;
  readonly gap?: number;
  readonly margin?: number;
}

const GAP = 12;
const MARGIN = 8;
/** Anchors covering this share of the viewport on either axis are "near viewport size". */
const NEAR_VIEWPORT = 0.8;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));

const offscreenOf = (anchor: Box, viewport: Size): Placement['offscreen'] => {
  if (anchor.y + anchor.h <= 0) return 'above';
  if (anchor.y >= viewport.h) return 'below';
  return null;
};

/** Pure placement: right, then left, then below, then above; dock bottom-right when none fit. */
export const place = ({
  anchor,
  size,
  viewport,
  gap = GAP,
  margin = MARGIN,
}: PlaceInput): Placement => {
  const offscreen = offscreenOf(anchor, viewport);
  const maxX = viewport.w - size.w - margin;
  const maxY = viewport.h - size.h - margin;
  const dock: Placement = {
    x: Math.max(margin, maxX),
    y: Math.max(margin, maxY),
    side: 'dock',
    offscreen,
  };
  const near = anchor.w >= viewport.w * NEAR_VIEWPORT || anchor.h >= viewport.h * NEAR_VIEWPORT;
  if (near && offscreen === null) return dock;

  const column = clamp(anchor.y, margin, Math.max(margin, maxY));
  const row = clamp(anchor.x, margin, Math.max(margin, maxX));
  const candidates: readonly (Placement & { readonly fits: boolean })[] = [
    {
      x: anchor.x + anchor.w + gap,
      y: column,
      side: 'right',
      offscreen,
      fits: anchor.x + anchor.w + gap <= maxX,
    },
    {
      x: anchor.x - gap - size.w,
      y: column,
      side: 'left',
      offscreen,
      fits: anchor.x - gap - size.w >= margin,
    },
    {
      x: row,
      y: anchor.y + anchor.h + gap,
      side: 'below',
      offscreen,
      fits: anchor.y + anchor.h + gap <= maxY,
    },
    {
      x: row,
      y: anchor.y - gap - size.h,
      side: 'above',
      offscreen,
      fits: anchor.y - gap - size.h >= margin,
    },
  ];
  const hit = candidates.find((c) => c.fits);
  if (!hit) return dock;
  const { fits, ...placement } = hit;
  void fits;
  return placement;
};
