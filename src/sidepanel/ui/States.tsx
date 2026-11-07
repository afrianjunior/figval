import { copy } from '../../copy';
import { Button, Skeleton, icons } from '../../ui';
import type { ErrorTag } from '../../domain';
import { usePanel } from './context';
import { UnsupportedNote } from './Toolbar';

const t = copy.panel.states;

const SKELETON_ROWS = [72, 58, 66, 48] as const;

/** Rows with the proportions of the real list, so nothing jumps when data arrives. */
export function LoadingView() {
  return (
    <div className="fvp-loading" role="status" aria-busy="true">
      <span className="fv-sr-only">{t.loading}</span>
      <div className="fvp-loading__head">
        <Skeleton width={120} height={14} />
        <Skeleton width={20} height={14} />
      </div>
      <Skeleton height={32} />
      {SKELETON_ROWS.map((w) => (
        <div key={w} className="fvp-loading__row">
          <Skeleton width={36} height={10} />
          <Skeleton width={`${w}%`} height={10} />
        </div>
      ))}
    </div>
  );
}

export function FirstRunView({ unsupported, disabled, error }: { readonly unsupported: boolean; readonly disabled: boolean; readonly error: ErrorTag | undefined }) {
  const { actions } = usePanel();
  if (unsupported) return <UnsupportedNote />;
  return (
    <div className="fvp-empty fvp-empty--first">
      <p className="fvp-empty__line">{t.firstRun.line}</p>
      <Button
        variant="primary"
        size="md"
        icon={icons.pick}
        kbd={copy.keys.toggleShortcut}
        disabled={disabled}
        onClick={() => void actions.pick()}
      >
        {t.firstRun.cta}
      </Button>
      {error === undefined ? null : (
        <p role="alert" className="fvp-error">
          {copy.errors[error]}
        </p>
      )}
    </div>
  );
}

export function EmptySessionView() {
  return (
    <div className="fvp-empty">
      <p className="fvp-empty__line">{t.emptySession.line}</p>
    </div>
  );
}

export function NoResultsView({ query }: { readonly query: string }) {
  const { actions } = usePanel();
  return (
    <div className="fvp-empty" role="status">
      <p className="fvp-empty__line">{query === '' ? t.noResults.filterLine : t.noResults.line(query)}</p>
      <Button onClick={() => void actions.resetFilters()}>{t.noResults.reset}</Button>
    </div>
  );
}
