import { useState } from 'react';
import { copy } from '../../copy';
import { Button, Icon, Slider, icons } from '../../ui';
import type { NoteId, Note } from '../../domain';
import { usePanel } from './context';
import { useShotUrl } from './hooks';

const t = copy.panel.detail;
const SPLIT_START = 50;

function Placeholder() {
  return (
    <div className="fvp-shot__none">
      <Icon icon={icons.image} />
      <span>{t.noScreenshot}</span>
    </div>
  );
}

interface FrameProps {
  readonly before: string | null;
  readonly after: string | null;
  readonly split: number;
}

/** After is clipped from the left edge; the divider position follows the slider. */
function Frame({ before, after, split }: FrameProps) {
  if (before === null && after === null) return <Placeholder />;
  const only = before === null ? after : after === null ? before : null;
  if (only !== null) return <img className="fvp-shot__img" src={only} alt="" />;
  return (
    <div className="fvp-shot__stack">
      <img className="fvp-shot__img" src={before ?? ''} alt="" />
      <img
        className="fvp-shot__img fvp-shot__img--over"
        src={after ?? ''}
        alt=""
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
      />
      <span className="fvp-shot__divider" style={{ left: `${split}%` }} aria-hidden="true" />
    </div>
  );
}

export function ShotBlock({ note }: { readonly note: Note }) {
  const { store, actions, model } = usePanel();
  const [split, setSplit] = useState(SPLIT_START);
  const before = useShotUrl(store, note.shots.before);
  const after = useShotUrl(store, note.shots.after);
  const copyShot = (which: 'before' | 'after') => void actions.copyShot(note.id as NoteId, which);
  const flashed = (which: 'before' | 'after') => model.ui.flashId === `shot:${note.id}:${which}`;
  const both = before !== null && after !== null;
  return (
    <section className="fvp-shot" aria-labelledby={`shot-${note.id}`}>
      <h3 id={`shot-${note.id}`} className="fvp-sub-title">
        {t.screenshot}
      </h3>
      <Frame before={before} after={after} split={split} />
      {both ? (
        <Slider label={t.screenshot} min={0} max={100} value={split} unit="%" onChange={setSplit} />
      ) : null}
      <div className="fvp-shot__actions">
        <Button
          disabled={note.shots.before === null}
          icon={flashed('before') ? icons.check : icons.copy}
          onClick={() => copyShot('before')}
        >
          {t.copyBefore}
        </Button>
        <Button
          disabled={note.shots.after === null}
          icon={flashed('after') ? icons.check : icons.copy}
          onClick={() => copyShot('after')}
        >
          {t.copyAfter}
        </Button>
      </div>
    </section>
  );
}
