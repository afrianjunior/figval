import { useState } from 'react';
import { copy } from '../../copy';
import { normalizePage, type Note } from '../../domain';
import { Badge, Button, Checkbox, Field, IconButton, Textarea, icons } from '../../ui';
import type { PanelState } from '../model';
import { usePanel } from './context';
import { DetailChanges } from './DetailChanges';
import { useHeadingFocus } from './hooks';
import { Locator } from './Locator';
import { Menu } from './Menu';
import { ShotBlock } from './ShotBlock';

const t = copy.panel.detail;
type DetailState = Extract<PanelState, { readonly _tag: 'Detail' }>;

/** Textarea that keeps its own draft; every change goes to the model, which debounces the save. */
function AutosaveField({
  note,
  field,
  label,
  error,
}: {
  readonly note: Note;
  readonly field: 'comment' | 'why';
  readonly label: string;
  readonly error: string | undefined;
}) {
  const { actions } = usePanel();
  const [value, setValue] = useState(note[field]);
  return (
    <Field label={label} {...(error === undefined ? {} : { error })}>
      {(control) => (
        <Textarea
          {...control}
          autosize
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            void actions.updateNote(note.id, { [field]: e.target.value });
          }}
        />
      )}
    </Field>
  );
}

function WhyBlock({ note, error }: { readonly note: Note; readonly error: string | undefined }) {
  const [adding, setAdding] = useState(false);
  if (note.why === '' && !adding) {
    return (
      <Button variant="ghost" className="fvp-add-reason" onClick={() => setAdding(true)}>
        {t.addReason}
      </Button>
    );
  }
  return <AutosaveField note={note} field="why" label={t.why} error={error} />;
}

function DetailBody({ panel }: { readonly panel: DetailState }) {
  const { actions, model } = usePanel();
  const { note } = panel.row;
  const tag = panel.shell.errors[`note:${note.id}`];
  const error = tag === undefined ? undefined : copy.errors[tag];
  const p = normalizePage(note.page.url);
  return (
    <div className="fvp-scroll fvp-detail__body">
      <p className="fv-mono fvp-meta">
        {t.meta(p.path, note.page.viewport.w, note.page.viewport.h, panel.shell.toolbar.beforeAfter)}
      </p>
      {panel.row.notFound ? (
        <div className="fvp-missing" role="status">
          <Badge tone="missing">{copy.panel.states.notFound.badge}</Badge>
          <p>{t.notFoundExplanation}</p>
        </div>
      ) : null}
      <AutosaveField note={note} field="comment" label={t.comment} error={error} />
      <WhyBlock note={note} error={undefined} />
      {panel.canForceApply ? (
        <Checkbox
          label={t.letAgentApply}
          checked={note.forceApply}
          onChange={(e) => void actions.updateNote(note.id, { forceApply: e.target.checked })}
        />
      ) : null}
      <DetailChanges edits={note.edits} />
      <Button icon={icons.edit} onClick={() => void actions.editOnPage(note.id)}>
        {t.editOnPage}
      </Button>
      <ShotBlock note={note} />
      <Locator target={note.target} defaultOpen={model.settings.preset === 'developer'} />
      <Button variant="danger" icon={icons.delete} onClick={() => void actions.deleteNote(note.id)}>
        {t.deleteNote}
      </Button>
    </div>
  );
}

export function Detail({ panel }: { readonly panel: DetailState }) {
  const { actions } = usePanel();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const { note, label } = panel.row;
  return (
    <section className="fvp-sub" aria-labelledby="fvp-detail-title">
      <header className="fvp-sub__head">
        <IconButton label={t.back} icon={icons.back} onClick={() => void actions.back()} />
        <h2 id="fvp-detail-title" ref={heading} tabIndex={-1} className="fvp-sub__title">
          {t.title(label, note.target.label)}
        </h2>
        <Menu
          label={t.menuLabel}
          items={[
            { label: t.editOnPage, icon: icons.edit, onSelect: () => void actions.editOnPage(note.id) },
            { label: t.deleteNote, icon: icons.delete, danger: true, onSelect: () => void actions.deleteNote(note.id) },
          ]}
        />
      </header>
      <DetailBody key={note.id} panel={panel} />
    </section>
  );
}
