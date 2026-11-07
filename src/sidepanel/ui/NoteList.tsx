import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import type { NoteId } from '../../domain';
import type { GroupVm, PanelState } from '../model';
import { usePanel } from './context';
import { useContainerWidth } from './hooks';
import { NoteGroup } from './NoteGroup';
import { showsThumbnail } from './reorder';

type ReadyState = Extract<PanelState, { readonly _tag: 'Ready' }>;

export interface NoteListProps {
  readonly panel: ReadyState;
}

const rowButtons = (root: HTMLElement): readonly HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('.fv-layer__main'),
];

/** ↑/↓ move focus between rows; Enter and Delete are handled by the focused row. */
const onListKeys = (event: KeyboardEvent<HTMLElement>) => {
  if (event.altKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
  const buttons = rowButtons(event.currentTarget);
  const at = buttons.indexOf(document.activeElement as HTMLElement);
  if (at === -1) return;
  event.preventDefault();
  buttons[Math.max(0, Math.min(buttons.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
};

const flatten = (groups: readonly GroupVm[], replaceKey: string, replacement: readonly string[]): readonly NoteId[] =>
  groups.flatMap((g) => (g.pageKey === replaceKey ? replacement : g.rows.map((r) => r.note.id as string))) as NoteId[];

export function NoteList({ panel }: NoteListProps) {
  const { actions } = usePanel();
  const ref = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(ref);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const withCheckbox = panel.shell.footer.scope === 'selected';
  const withThumb = showsThumbnail(width);

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const reorder = useCallback(
    (pageKey: string, ids: readonly string[]) => void actions.reorder(flatten(panel.groups, pageKey, ids)),
    [actions, panel.groups],
  );

  return (
    <div ref={ref} className="fvp-list" onKeyDown={onListKeys}>
      {panel.groups.map((group) => (
        <NoteGroup
          key={group.pageKey}
          group={group}
          open={group.isCurrent || !collapsed.has(group.pageKey)}
          onToggle={toggle}
          withCheckbox={withCheckbox}
          withThumb={withThumb}
          onReorder={reorder}
        />
      ))}
    </div>
  );
}
