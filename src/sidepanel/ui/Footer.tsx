import { copy } from '../../copy';
import { Button, Segmented, Select, icons, type SelectOption } from '../../ui';
import type { ExportScope, Shell } from '../model';
import { usePanel } from './context';

const t = copy.panel.footer;

const scopeOptions = (footer: Shell['footer']): readonly SelectOption[] => [
  { value: 'all', label: t.scope.allPages },
  { value: 'page', label: t.scope.thisPage },
  { value: 'selected', label: t.scope.selected(footer.counts.selected) },
  ...(footer.filterActive ? [{ value: 'filtered', label: t.scope.filtered(footer.counts.filtered) }] : []),
];

export function Footer({ shell }: { readonly shell: Shell }) {
  const { actions } = usePanel();
  const { footer, flashId } = shell;
  const hint = footer.hintKey === null ? null : copy.panel.states[footer.hintKey].hint;
  return (
    <footer className="fvp-foot">
      <div className="fvp-foot__row">
        <Segmented
          label={t.format.label}
          value={footer.format}
          onChange={(v) => void actions.setFormat(v)}
          options={[
            { value: 'llm', label: t.format.llm },
            { value: 'human', label: t.format.human },
          ]}
        />
        <Select
          aria-label={t.scope.label}
          value={footer.scope}
          options={scopeOptions(footer)}
          onChange={(v) => void actions.setScope(v as ExportScope)}
          className="fvp-foot__scope"
        />
      </div>
      <div className="fvp-foot__row">
        <Button
          variant="primary"
          size="md"
          className="fvp-foot__copy"
          icon={flashId === 'export-copy' ? icons.check : icons.copy}
          disabled={footer.exportDisabled}
          onClick={() => void actions.exportCopy()}
        >
          {flashId === 'export-copy' ? t.copied : t.copyMarkdown}
        </Button>
        <Button
          size="md"
          icon={icons.download}
          disabled={footer.exportDisabled}
          onClick={() => void actions.exportDownload()}
        >
          {t.download}
        </Button>
      </div>
      {hint === null ? null : <p className="fvp-foot__hint">{hint}</p>}
    </footer>
  );
}
