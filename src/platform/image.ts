import { cropRegion } from './capture-math';
import type { Rect } from './types';

export const WEBP_QUALITY = 0.85;

/** Smallest valid WebP (1×1), used by test layers. */
export const FIXED_WEBP_BASE64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

export const fixedWebp = (): Blob => {
  const bytes = Uint8Array.from(atob(FIXED_WEBP_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/webp' });
};

const encodeCanvas = async (
  bitmap: ImageBitmap,
  region: { sx: number; sy: number; sw: number; sh: number },
  type: 'image/webp' | 'image/png',
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(region.sw, region.sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, region.sx, region.sy, region.sw, region.sh, 0, 0, region.sw, region.sh);
  bitmap.close();
  return canvas.convertToBlob({ type, quality: WEBP_QUALITY });
};

/** Crops a screenshot data URL to `rect` (CSS px × dpr) and encodes it as WebP. */
export const cropToWebp = async (dataUrl: string, rect: Rect, dpr: number): Promise<Blob> => {
  const source = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(source);
  const region = cropRegion(rect, dpr, { width: bitmap.width, height: bitmap.height });
  if (region.sw === 0 || region.sh === 0) {
    bitmap.close();
    throw new Error('crop region is empty');
  }
  return encodeCanvas(bitmap, region, 'image/webp');
};

/** Full-image re-encode: WebP → PNG (the clipboard accepts only PNG for images). */
export const webpToPng = async (webp: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(webp);
  return encodeCanvas(bitmap, { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }, 'image/png');
};
