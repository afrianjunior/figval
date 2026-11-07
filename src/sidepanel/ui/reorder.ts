/** Rows show a screenshot thumbnail once the list is at least this wide (spec §10.2). */
export const THUMB_MIN_WIDTH = 340;

export const showsThumbnail = (width: number): boolean => width >= THUMB_MIN_WIDTH;

/** Returns a new array with `id` moved to `to` (clamped). Unknown ids leave the order unchanged. */
export const moveId = <T>(ids: readonly T[], id: T, to: number): readonly T[] => {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const rest = ids.filter((_, i) => i !== from);
  const target = Math.max(0, Math.min(to, rest.length));
  return [...rest.slice(0, target), id, ...rest.slice(target)];
};

/** Slot whose vertical midpoint is closest to `y`; ties go to the earlier slot. */
export const indexAtY = (midpoints: readonly number[], y: number): number =>
  midpoints.reduce(
    (best, mid, i) => (Math.abs(mid - y) < Math.abs((midpoints[best] ?? mid) - y) ? i : best),
    0,
  );
