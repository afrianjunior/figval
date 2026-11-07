import type { Rect } from './types';

export interface PixelRegion {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** Crop region in device pixels: CSS rect × dpr, rounded outward, clamped to the image. */
export const cropRegion = (rect: Rect, dpr: number, image: ImageSize): PixelRegion => {
  const left = Math.max(0, Math.floor(rect.x * dpr));
  const top = Math.max(0, Math.floor(rect.y * dpr));
  const right = Math.min(image.width, Math.ceil((rect.x + rect.w) * dpr));
  const bottom = Math.min(image.height, Math.ceil((rect.y + rect.h) * dpr));
  return { sx: left, sy: top, sw: Math.max(0, right - left), sh: Math.max(0, bottom - top) };
};
