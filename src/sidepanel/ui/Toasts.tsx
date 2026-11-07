import { useCallback, useEffect, useState } from 'react';
import { copy } from '../../copy';
import { Button, Toast } from '../../ui';
import type { ErrorKey, PanelStateTag, Shell } from '../model';
import { usePanel } from './context';
import { usePauseHandlers } from './usePause';

const t = copy.toasts;
export const ERROR_TOAST_MS = 8000;

/** Errors that appear next to their own control instead of in a toast. */
const inline = (key: ErrorKey, view: PanelStateTag): boolean => {
  if (key === 'pick' || key === 'showNotes') return view === 'Ready' || view === 'EmptySession' || view === 'FirstRun';
  if (key === 'settings') return view === 'Settings';
  if (key === 'session') return view === 'Sessions';
  return view === 'Detail' && key.startsWith('note:');
};

const FLASH_MESSAGES: Readonly<Record<string, string>> = {
  'export-copy': t.copied,
  'export-download': t.downloaded,
};

function ErrorToast({ errorKey, tag }: { readonly errorKey: ErrorKey; readonly tag: keyof typeof copy.errors }) {
  const { actions } = usePanel();
  const [paused, setPaused] = useState(false);
  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const pauseHandlers = usePauseHandlers(pause, resume);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => void actions.dismissError(errorKey), ERROR_TOAST_MS);
    return () => clearTimeout(timer);
  }, [actions, errorKey, tag, paused]);
  const denied = tag === 'ClipboardDenied';
  return (
    <Toast
      {...pauseHandlers}
      onClose={() => void actions.dismissError(errorKey)}
      closeLabel={t.dismiss}
      message={denied ? t.clipboardDenied : copy.errors[tag]}
      action={
        denied ? (
          <Button
            size="sm"
            onClick={() => {
              void actions.dismissError(errorKey);
              void actions.exportDownload();
            }}
          >
            {t.clipboardDeniedAction}
          </Button>
        ) : undefined
      }
    />
  );
}

function UndoToast() {
  const { actions } = usePanel();
  const pause = useCallback(() => void actions.pauseUndo(), [actions]);
  const resume = useCallback(() => void actions.resumeUndo(), [actions]);
  const pauseHandlers = usePauseHandlers(pause, resume);
  return (
    <Toast
      {...pauseHandlers}
      message={t.deleted}
      action={
        <Button size="sm" onClick={() => void actions.undoDelete()}>
          {t.undo}
        </Button>
      }
    />
  );
}

export function Toasts({ shell, view }: { readonly shell: Shell; readonly view: PanelStateTag }) {
  const errors = (Object.entries(shell.errors) as [ErrorKey, keyof typeof copy.errors][]).filter(
    ([key]) => !inline(key, view),
  );
  const flash = shell.flashId === null ? undefined : FLASH_MESSAGES[shell.flashId];
  return (
    <div className="fvp-toasts" aria-live="polite">
      {shell.pendingDelete === null ? null : <UndoToast />}
      {flash === undefined ? null : <Toast message={flash} />}
      {errors.map(([key, tag]) => (
        <ErrorToast key={key} errorKey={key} tag={tag} />
      ))}
    </div>
  );
}
