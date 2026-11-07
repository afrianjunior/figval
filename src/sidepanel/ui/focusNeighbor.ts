const MAIN = '.fv-layer__main';

const mainOf = (li: Element | null): HTMLElement | null => li?.querySelector<HTMLElement>(MAIN) ?? null;

/**
 * Before a row is removed, moves focus to the next row's main button, else the
 * previous row's, else the group heading, so keyboard users stay in the list
 * and can still reach the Undo toast.
 */
export function focusNeighbor(row: HTMLElement): void {
  const target =
    mainOf(row.nextElementSibling) ??
    mainOf(row.previousElementSibling) ??
    row.closest('section')?.querySelector<HTMLElement>('.fvp-group__head');
  if (!target) return;
  if (!target.matches('button')) target.tabIndex = -1;
  target.focus();
}
