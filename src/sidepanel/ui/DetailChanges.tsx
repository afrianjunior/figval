import type { Edits, StyleChange } from '../../domain';
import { copy } from '../../copy';
import { Icon, PropertyRow, PropertySection, Swatch, icons } from '../../ui';

const t = copy.panel.detail;
const COLOR_PROPS: ReadonlySet<string> = new Set(['color', 'background-color']);

function StyleValue({ change }: { readonly change: StyleChange }) {
  const isColor = COLOR_PROPS.has(change.property);
  return (
    <span className="fvp-change">
      {isColor ? <Swatch size="sm" color={change.after} label={change.after} /> : null}
      <span className="fv-mono">{t.styleChange(change.property, change.before, change.after)}</span>
    </span>
  );
}

/** Read-only property rows for what the note changes on the page. */
export function DetailChanges({ edits }: { readonly edits: Edits }) {
  const rows = [
    edits.text === null ? null : (
      <PropertyRow key="text" label={t.rows.text} changed>
        <span className="fv-mono">{t.textChange(edits.text.before, edits.text.after)}</span>
      </PropertyRow>
    ),
    ...edits.style.map((change) => (
      <PropertyRow key={change.property} label={t.rows.style} changed>
        <StyleValue change={change} />
      </PropertyRow>
    )),
    edits.hidden ? (
      <PropertyRow key="hide" label={copy.panel.search.chips.hide} changed>
        <Icon icon={icons.hide} />
      </PropertyRow>
    ) : null,
  ].filter((row) => row !== null);
  if (rows.length === 0) return null;
  return (
    <PropertySection title={t.changes}>
      {rows}
      <PropertyRow label={t.rows.scope}>
        <span>{edits.scope === 'similar' ? t.scopeAll(edits.similarCount) : t.scopeOne}</span>
      </PropertyRow>
    </PropertySection>
  );
}
