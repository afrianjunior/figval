import { Effect, Stream, type Scope } from 'effect';

export interface TextEditSession {
  readonly current: () => string;
  readonly onInput: Stream.Stream<string>;
}

interface Snapshot {
  readonly contenteditable: string | null;
  readonly outline: string;
  readonly outlinePriority: string;
  readonly styleAttr: string | null;
  afterSet: string | null;
}

const snapshot = (el: HTMLElement): Snapshot => ({
  contenteditable: el.getAttribute('contenteditable'),
  outline: el.style.getPropertyValue('outline'),
  outlinePriority: el.style.getPropertyPriority('outline'),
  styleAttr: el.getAttribute('style'),
  afterSet: null,
});

const restore = (el: HTMLElement, s: Snapshot): void => {
  if (s.contenteditable === null) el.removeAttribute('contenteditable');
  else el.setAttribute('contenteditable', s.contenteditable);
  if (s.afterSet !== null && el.getAttribute('style') === s.afterSet) {
    // Untouched since we set the outline: put back the exact original attribute.
    if (s.styleAttr === null) el.removeAttribute('style');
    else el.setAttribute('style', s.styleAttr);
    return;
  }
  if (s.outline === '') el.style.removeProperty('outline');
  else el.style.setProperty('outline', s.outline, s.outlinePriority);
  if (el.getAttribute('style') === '') el.removeAttribute('style');
};

const inputs = (el: HTMLElement): Stream.Stream<string> =>
  Stream.async<string>((emit) => {
    const handler = (): void => void emit.single(el.textContent ?? '');
    el.addEventListener('input', handler);
    return Effect.sync(() => el.removeEventListener('input', handler));
  });

/** Makes el contenteditable with a dashed outline until the scope closes. */
export const startTextEdit = (el: Element): Effect.Effect<TextEditSession, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const target = el as HTMLElement;
      const before = snapshot(target);
      target.setAttribute('contenteditable', 'plaintext-only');
      target.style.setProperty('outline', '2px dashed currentColor', 'important');
      before.afterSet = target.getAttribute('style');
      return { target, before };
    }),
    ({ target, before }) => Effect.sync(() => restore(target, before)),
  ).pipe(
    Effect.map(({ target }) => ({
      current: () => target.textContent ?? '',
      onInput: inputs(target),
    })),
  );
