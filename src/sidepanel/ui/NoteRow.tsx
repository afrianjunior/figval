import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { copy } from '../../copy';
import { Badge, Checkbox, LayerRow, cx } from '../../ui';
import type { RowVm } from '../model';
import { usePanel } from './context';
import { useShotUrl } from './hooks';

const t = copy.panel.list;
const chips = copy.panel.search.chips;

function Thumb({ row }: { readonly row: RowVm }) {
  const { store } = usePanel();
  const { shots } = row.note;
  const url = useShotUrl(store, shots.after ?? shots.before);
  if (url === null) return <span className="fvp-thumb fvp-thumb--empty" aria-hidden="true" />;
  return <img className="fvp-thumb" src={url} alt={t.thumbnailAlt(row.label)} width={44} height={30} />;
}

export interface NoteRowProps {
  readonly row: RowVm;
  readonly withCheckbox: boolean;
  readonly withThumb: boolean;
  readonly dragging: boolean;
  readonly onGripDown: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  readonly onMove: (id: string, delta: -1 | 1) => void;
}

export function NoteRow({ row, withCheckbox, withThumb, dragging, onGripDown, onMove }: NoteRowProps) {
  const { actions } = usePanel();
  const { note } = row;

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      event.stopPropagation();
      onMove(note.id, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Delete' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      void actions.deleteNote(note.id);
    }
  };

  const tagText = row.tags.map((tag) => chips[tag]).join('·');
  return (
    <LayerRow
      draggable
      data-focus-key={`note:${note.id}`}
      data-note-id={note.id}
      className={cx('fvp-row', row.hovered && 'fvp-row--hovered', dragging && 'fvp-row--drag')}
      title={
        <>
          <span className="fv-mono fvp-row__id">{row.label}</span>
          <span className="fvp-row__label">{note.target.label}</span>
        </>
      }
      description={
        tagText === '' && note.comment === '' ? undefined : (
          <>
            {tagText === '' ? null : <span className="fv-mono fvp-row__tags">{tagText}</span>}
            {note.comment}
          </>
        )
      }
      meta={
        <>
          {row.intent === 'propose' ? <Badge tone="propose">{t.badge.propose}</Badge> : null}
          {row.notFound ? <Badge tone="missing">{t.badge.notFound}</Badge> : null}
        </>
      }
      leading={
        withCheckbox ? (
          <Checkbox
            aria-label={t.selectRow(row.label)}
            checked={row.selected}
            onChange={() => void actions.toggleSelected(note.id)}
          />
        ) : undefined
      }
      trailing={withThumb ? <Thumb row={row} /> : undefined}
      onSelect={() => void actions.open(note.id)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => onGripDown(e, note.id)}
      onPointerEnter={() => void actions.hover(note.id)}
      onPointerLeave={() => void actions.hover(null)}
      onFocus={() => void actions.hover(note.id)}
      onBlur={() => void actions.hover(null)}
    />
  );
}
