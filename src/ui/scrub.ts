export interface ScrubRange {
  readonly min?: number;
  readonly max?: number;
}

export const SHIFT_MULTIPLIER = 10;

export const clamp = (value: number, { min, max }: ScrubRange): number => {
  const lower = min === undefined ? value : Math.max(min, value);
  return max === undefined ? lower : Math.min(max, lower);
};

const decimals = (step: number): number => {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
};

export const snap = (value: number, step: number): number =>
  Number((Math.round(value / step) * step).toFixed(decimals(step)));

export const scrubValue = (
  start: number,
  deltaPx: number,
  step: number,
  shift: boolean,
  range: ScrubRange,
): number => {
  const factor = shift ? SHIFT_MULTIPLIER : 1;
  return clamp(snap(start + Math.round(deltaPx) * step * factor, step), range);
};

export const nudgeValue = (
  value: number,
  direction: 1 | -1,
  step: number,
  shift: boolean,
  range: ScrubRange,
): number => clamp(snap(value + direction * step * (shift ? SHIFT_MULTIPLIER : 1), step), range);

export const parseNumber = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};
