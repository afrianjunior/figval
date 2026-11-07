import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { copy } from '../../copy';
import { Icon, icons } from '../../ui';
import type { GroupVm } from '../model';
import { NoteRow } from './NoteRow';
import { indexAtY, moveId } from './reorder';

const t = copy.panel.list;

interface Drag {
  readonly id: string;
  readonly to: number;
  readonly mids: readonly number[];
}

export interface NoteGroupProps {
  readonly group: GroupVm;
  readonly open: boolean;
  readonly onToggle: (pageKey: string) => void;
  readonly withCheckbox: boolean;
  readonly withThumb: boolean;
  readonly onReorder: (pageKey: string, ids: readonly string[]) => void;
}

const midpoints = (list: HTMLElement): readonly number[] =>
  [...list.children].map((li) => {
    const box = li.getBoundingClientRect();
    return box.top + box.height / 2;
  });

function GroupHead({ group, open, onToggle }: Pick<NoteGroupProps, 'group' | 'open' | 'onToggle'>) {
  const first = group.rows[0]?.note.page.title ?? group.host;
  const inner = (
    <>
      <span className="fv-mono fvp-group__path">{group.path}</span>
      <span className="fvp-group__sub">{group.isCurrent ? t.groupThisPage : first}</span>
      <span className="fvp-group__count">{t.pageCount(group.rows.length)}</span>
    </>
  );
  if (group.isCurrent) return <h3 className="fvp-group__head">{inner}</h3>;
  return (
    <h3 className="fvp-group__headwrap">
      <button
        type="button"
        className="fvp-group__head fvp-group__head--btn"
        aria-expanded={open}
        onClick={() => onToggle(group.pageKey)}
        data-focus-key={`group:${group.pageKey}`}
      >
        <Icon icon={open ? icons.chevronDown : icons.chevronRight} />
        {inner}
      </button>
    </h3>
  );
}

export function NoteGroup({ group, open, onToggle, withCheckbox, withThumb, onReorder }: NoteGroupProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const refocus = useRef<string | null>(null);
  const ids = useMemo(() => group.rows.map((r) => r.note.id as string), [group.rows]);
  const order = drag === null ? ids : moveId(ids, drag.id, drag.to);
  const rows = order.flatMap((id) => group.rows.filter((r) => r.note.id === id));
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) =>
      setDrag((d) => (d === null ? d : { ...d, to: indexAtY(d.mids, event.clientY) }));
    const stop = (commit: boolean) => (event: PointerEvent) => {
      setDrag((d) => {
        if (d !== null && commit) {
          const next = moveId(ids, d.id, indexAtY(d.mids, event.clientY));
          if (next.join() !== ids.join()) onReorder(group.pageKey, next);
        }
        return null;
      });
    };
    const up = stop(true);
    const cancel = stop(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging, ids, group.pageKey, onReorder]);

  useEffect(() => {
    const id = refocus.current;
    if (id === null) return;
    refocus.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-note-id="${id}"] .fv-layer__main`)?.focus();
  });

  const onGripDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    const onGrip = event.target instanceof Element && event.target.closest('.fv-layer__grip') !== null;
    if (!onGrip || listRef.current === null || event.button !== 0) return;
    event.preventDefault();
    const mids = midpoints(listRef.current);
    setDrag({ id, to: ids.indexOf(id), mids });
  };

  const onMove = (id: string, delta: -1 | 1) => {
    const next = moveId(ids, id, ids.indexOf(id) + delta);
    if (next.join() === ids.join()) return;
    refocus.current = id;
    onReorder(group.pageKey, next);
  };

  return (
    <section className="fvp-group" aria-label={group.path}>
      <GroupHead group={group} open={open} onToggle={onToggle} />
      {open ? (
        rows.length === 0 ? (
          <p className="fvp-group__empty">{copy.panel.states.emptyCurrentPage.line}</p>
        ) : (
          <ul ref={listRef} className="fvp-rows">
            {rows.map((row) => (
              <NoteRow
                key={row.note.id}
                row={row}
                withCheckbox={withCheckbox}
                withThumb={withThumb}
                dragging={drag?.id === row.note.id}
                onGripDown={onGripDown}
                onMove={onMove}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
