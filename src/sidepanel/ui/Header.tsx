import { useRef, useState, type KeyboardEvent } from 'react';
import { copy } from '../../copy';
import { Icon, Input, icons } from '../../ui';
import type { Shell } from '../model';
import { usePanel } from './context';
import { FOCUS_KEY } from './hooks';
import { Menu, type MenuItem } from './Menu';

const t = copy.panel.header;

interface RenameProps {
  readonly initial: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
}

function RenameInput({ initial, onCommit, onCancel }: RenameProps) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (commit && name !== '' && name !== initial) onCommit(name);
    else onCancel();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') {
      event.stopPropagation();
      finish(false);
    }
  };
  return (
    <Input
      autoFocus
      aria-label={copy.panel.sessions.renameLabel}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
      className="fvp-head__rename"
    />
  );
}

export function Header({ header }: { readonly header: Shell['header'] }) {
  const { actions } = usePanel();
  const [renaming, setRenaming] = useState(false);
  const { sessionId, sessionName, count } = header;

  const items: readonly MenuItem[] = [
    { label: t.menu.settings, onSelect: () => void actions.navigate('settings') },
    ...(sessionId === null
      ? []
      : [
          { label: t.menu.rename, onSelect: () => setRenaming(true) },
          {
            label: t.menu.deleteSession,
            danger: true,
            onSelect: () =>
              void actions.navigate('sessions').then(() => actions.requestDeleteSession(sessionId)),
          },
        ]),
  ];

  return (
    <header className="fvp-head">
      {renaming && sessionId !== null && sessionName !== null ? (
        <RenameInput
          initial={sessionName}
          onCommit={(name) => void actions.renameSession(sessionId, name)}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <button
          type="button"
          className="fvp-head__switch"
          title={t.sessionSwitcherLabel}
          onClick={() => void actions.navigate('sessions')}
          {...{ [FOCUS_KEY]: 'header-switch' }}
        >
          <span className="fvp-head__name">
            {sessionName === null ? t.noSession : t.sessionTitle(sessionName, count)}
          </span>
          <Icon icon={icons.chevronDown} />
        </button>
      )}
      <Menu label={t.menuLabel} items={items} focusKey="header-menu" />
    </header>
  );
}
