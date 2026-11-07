import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { PanelState, usePanelStore, type PanelStore, type Shell } from '../model';
import { PanelContext } from './context';
import { Detail } from './Detail';
import { Footer } from './Footer';
import { Header } from './Header';
import { useFocusReturn } from './hooks';
import { NoteList } from './NoteList';
import { SearchBar } from './SearchBar';
import { Sessions } from './Sessions';
import { Settings } from './Settings';
import { EmptySessionView, FirstRunView, LoadingView, NoResultsView } from './States';
import { StripBar } from './StripBar';
import { Toasts } from './Toasts';
import { Toolbar } from './Toolbar';

type ReadyState = Extract<PanelState, { readonly _tag: 'Ready' }>;

const isFindKey = (event: { readonly key: string; readonly metaKey: boolean; readonly ctrlKey: boolean }): boolean =>
  (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f';

const isUndoKey = (event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}): boolean => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';

/** Body area plus the toast layer that floats above the footer. */
function Stage({ shell, view, children }: { readonly shell: Shell; readonly view: PanelState['_tag']; readonly children: ReactNode }) {
  return (
    <div className="fvp-stage">
      {children}
      <Toasts shell={shell} view={view} />
    </div>
  );
}

function ReadyView({ panel, searchRef }: { readonly panel: ReadyState; readonly searchRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <>
      <Header header={panel.shell.header} />
      <Toolbar shell={panel.shell} />
      {panel.strip === null ? null : <StripBar strip={panel.strip} />}
      {panel.showSearch ? <SearchBar ref={searchRef} search={panel.search} filters={panel.filters} /> : null}
      <Stage shell={panel.shell} view="Ready">
        <main className="fvp-scroll">
          {panel.noResults === null ? (
            <NoteList panel={panel} />
          ) : (
            <NoResultsView query={panel.noResults.query} />
          )}
        </main>
      </Stage>
      <Footer shell={panel.shell} />
    </>
  );
}

export interface AppProps {
  readonly store: PanelStore;
}

export function App({ store }: AppProps) {
  const { model, panel, actions } = usePanelStore(store);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const drilledIn = panel._tag === 'Detail' || panel._tag === 'Sessions' || panel._tag === 'Settings';
  const trackOrigin = useFocusReturn(drilledIn, rootRef);
  const context = useMemo(() => ({ store, actions, model }), [store, actions, model]);
  const canSearch = panel._tag === 'Ready' && panel.showSearch;

  useEffect(() => {
    if (!canSearch) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!isFindKey(event)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSearch]);

  const deletePending = panel._tag !== 'Loading' && panel.shell.pendingDelete !== null;
  useEffect(() => {
    if (!deletePending) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!isUndoKey(event) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      void actions.undoDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deletePending, actions]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && drilledIn) void actions.back();
  };

  return (
    <PanelContext.Provider value={context}>
      <div ref={rootRef} className="fv-root fvp" onKeyDown={onKeyDown} onClickCapture={trackOrigin} onFocus={trackOrigin}>
        {PanelState.$match(panel, {
          Loading: () => <LoadingView />,
          FirstRun: (p) => (
            <>
              <Header header={p.shell.header} />
              <Stage shell={p.shell} view="FirstRun">
                <main className="fvp-scroll">
                  <FirstRunView
                    unsupported={p.unsupported}
                    disabled={p.shell.toolbar.pickDisabled}
                    error={p.shell.errors.pick ?? p.shell.errors.showNotes}
                  />
                </main>
              </Stage>
              <Footer shell={p.shell} />
            </>
          ),
          EmptySession: (p) => (
            <>
              <Header header={p.shell.header} />
              <Toolbar shell={p.shell} />
              <Stage shell={p.shell} view="EmptySession">
                <main className="fvp-scroll">
                  <EmptySessionView />
                </main>
              </Stage>
              <Footer shell={p.shell} />
            </>
          ),
          Ready: (p) => <ReadyView panel={p} searchRef={searchRef} />,
          Detail: (p) => (
            <Stage shell={p.shell} view="Detail">
              <Detail panel={p} />
            </Stage>
          ),
          Sessions: (p) => (
            <Stage shell={p.shell} view="Sessions">
              <Sessions panel={p} />
            </Stage>
          ),
          Settings: (p) => (
            <Stage shell={p.shell} view="Settings">
              <Settings panel={p} />
            </Stage>
          ),
        })}
      </div>
    </PanelContext.Provider>
  );
}
