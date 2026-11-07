import { useState, type KeyboardEvent } from 'react';
import { copy, formatShortDate } from '../../copy';
import type { SessionId } from '../../domain';
import { Button, Dialog, Icon, IconButton, Input, cx, icons } from '../../ui';
import type { PanelState, SessionRowVm } from '../model';
import { usePanel } from './context';
import { useHeadingFocus } from './hooks';

const t = copy.panel.sessions;
type SessionsState = Extract<PanelState, { readonly _tag: 'Sessions' }>;

function RenameRow({ row, onDone }: { readonly row: SessionRowVm; readonly onDone: () => void }) {
  const { actions } = usePanel();
  const [value, setValue] = useState(row.session.name);
  const commit = () => {
    const name = value.trim();
    if (name !== '' && name !== row.session.name) void actions.renameSession(row.session.id, name);
    onDone();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDone();
    }
  };
  return (
    <li className="fvp-session fvp-session--edit">
      <Input
        autoFocus
        aria-label={t.renameLabel}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </li>
  );
}

interface RowProps {
  readonly row: SessionRowVm;
  readonly onRename: (id: SessionId) => void;
}

function SessionRow({ row, onRename }: RowProps) {
  const { actions } = usePanel();
  const { session } = row;
  return (
    <li className={cx('fvp-session', row.isActive && 'fvp-session--active')}>
      <button
        type="button"
        className="fvp-session__main"
        aria-current={row.isActive ? 'true' : undefined}
        onClick={() => void actions.activateSession(session.id)}
      >
        {row.isActive ? <Icon icon={icons.check} /> : <span className="fvp-session__gap" />}
        <span className="fvp-session__name">{session.name}</span>
        <span className="fvp-session__meta">
          {t.noteCount(row.noteCount)} · {formatShortDate(session.updatedAt)}
        </span>
      </button>
      <IconButton label={`${t.rename} ${session.name}`} icon={icons.edit} onClick={() => onRename(session.id)} />
      <IconButton
        label={`${t.delete} ${session.name}`}
        icon={icons.delete}
        onClick={() => void actions.requestDeleteSession(session.id)}
      />
    </li>
  );
}

export function Sessions({ panel }: { readonly panel: SessionsState }) {
  const { actions } = usePanel();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const [renaming, setRenaming] = useState<SessionId | null>(null);
  const target = panel.confirmDelete;
  const errorTag = panel.shell.errors.session;
  return (
    <section className="fvp-sub" aria-labelledby="fvp-sessions-title">
      <header className="fvp-sub__head">
        <IconButton label={copy.panel.detail.back} icon={icons.back} onClick={() => void actions.back()} />
        <h2 id="fvp-sessions-title" ref={heading} tabIndex={-1} className="fvp-sub__title">
          {t.title}
        </h2>
        <Button icon={icons.plus} onClick={() => void actions.createSession()}>
          {t.newSession}
        </Button>
      </header>
      <div className="fvp-scroll fvp-sub__body">
        {errorTag === undefined ? null : (
          <p role="alert" className="fvp-error">
            {copy.errors[errorTag]}
          </p>
        )}
        <ul className="fvp-sessions">
          {panel.sessions.map((row) =>
            renaming === row.session.id ? (
              <RenameRow key={row.session.id} row={row} onDone={() => setRenaming(null)} />
            ) : (
              <SessionRow key={row.session.id} row={row} onRename={setRenaming} />
            ),
          )}
        </ul>
      </div>
      <Dialog
        open={target !== null}
        onClose={() => void actions.cancelDeleteSession()}
        title={target === null ? '' : t.deleteDialog.title(target.name)}
        footer={
          <>
            <Button onClick={() => void actions.cancelDeleteSession()}>{t.deleteDialog.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => target !== null && void actions.deleteSession(target.id)}
            >
              {t.deleteDialog.confirm}
            </Button>
          </>
        }
      >
        {target === null ? null : <p>{t.deleteDialog.body(target.noteCount)}</p>}
      </Dialog>
    </section>
  );
}
