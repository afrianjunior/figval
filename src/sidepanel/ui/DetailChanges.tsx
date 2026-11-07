import type { ReactNode } from 'react';
import type { Edits, StyleChange } from '../../domain';
import { copy } from '../../copy';
import { Icon, PropertyRow, PropertySection, Swatch, icons } from '../../ui';

const t = copy.panel.detail;
const groups = t.changeGroups;

type GroupKey = keyof typeof groups;

/** Which property section each style property belongs to. */
const STYLE_GROUP: Readonly<Record<StyleChange['property'], GroupKey>> = {
  color: 'fill',
  'background-color': 'fill',
  'font-size': 'typography',
  'font-weight': 'typography',
  'text-align': 'typography',
  'padding-block': 'layout',
  'padding-inline': 'layout',
  'border-radius': 'layout',
};

const controls = copy.tooltip.edit.controls;

/** Human label for each style property, from copy. */
const STYLE_LABEL: Readonly<Record<StyleChange['property'], string>> = {
  color: controls.textColor,
  'background-color': controls.background,
  'font-size': controls.fontSize,
  'font-weight': controls.fontWeight,
  'text-align': controls.textAlign,
  'padding-block': controls.paddingVertical,
  'padding-inline': controls.paddingHorizontal,
  'border-radius': controls.radius,
};

const COLOR_PROPS: ReadonlySet<string> = new Set(['color', 'background-color']);

function Value({ text, color }: { readonly text: string; readonly color: boolean }) {
  return (
    <span className="fvp-change__side">
      {color ? <Swatch size="sm" color={text} label={text} /> : null}
      <span className="fv-mono">{text}</span>
    </span>
  );
}

function StyleRow({ change }: { readonly change: StyleChange }) {
  const color = COLOR_PROPS.has(change.property);
  return (
    <PropertyRow label={STYLE_LABEL[change.property]} changed>
      <span className="fvp-change">
        <Value text={change.before} color={color} />
        <span className="fvp-change__to" aria-hidden="true">
          →
        </span>
        <span className="fv-sr-only">{t.changeTo}</span>
        <Value text={change.after} color={color} />
      </span>
    </PropertyRow>
  );
}

const rowsFor = (edits: Edits, group: GroupKey): readonly ReactNode[] => {
  if (group === 'text') {
    return edits.text === null
      ? []
      : [
          <PropertyRow key="text" label={t.rows.text} changed>
            <span className="fv-mono">{t.textChange(edits.text.before, edits.text.after)}</span>
          </PropertyRow>,
        ];
  }
  if (group === 'visibility') {
    return edits.hidden
      ? [
          <PropertyRow key="hide" label={copy.panel.search.chips.hide} changed>
            <Icon icon={icons.hide} />
          </PropertyRow>,
        ]
      : [];
  }
  return edits.style
    .filter((change) => STYLE_GROUP[change.property] === group)
    .map((change) => <StyleRow key={change.property} change={change} />);
};

const ORDER: readonly GroupKey[] = ['text', 'fill', 'typography', 'layout', 'visibility'];

/** Read-only property sections for what the note changes; a section appears only when it has changes. */
export function DetailChanges({ edits }: { readonly edits: Edits }) {
  const sections = ORDER.map((group) => ({ group, rows: rowsFor(edits, group) })).filter((s) => s.rows.length > 0);
  if (sections.length === 0) return null;
  return (
    <div className="fvp-changes">
      {sections.map(({ group, rows }) => (
        <PropertySection key={group} title={groups[group]}>
          {rows}
        </PropertySection>
      ))}
      <PropertyRow label={t.rows.scope}>
        <span>{edits.scope === 'similar' ? t.scopeAll(edits.similarCount) : t.scopeOne}</span>
      </PropertyRow>
    </div>
  );
}
