import { Duration, Effect, Queue, Stream, type Scope } from 'effect';
import type { EditRegistry } from './registry';

const REAPPLY_DEBOUNCE = Duration.millis(100);

/** Observer is attached synchronously on acquire so no mutation is missed before the stream starts. */
const observeChanges = (doc: Document): Effect.Effect<Stream.Stream<void>, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const queue = yield* Queue.sliding<void>(1);
      const observer = new MutationObserver(() => void Queue.unsafeOffer(queue, undefined));
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      return { queue, observer };
    }),
    ({ queue, observer }) =>
      Effect.zipRight(
        Effect.sync(() => observer.disconnect()),
        Queue.shutdown(queue),
      ),
  ).pipe(Effect.map(({ queue }) => Stream.fromQueue(queue)));

const reapplyChanged = (
  registry: EditRegistry,
  resolve: (noteId: string) => Element | null,
): Effect.Effect<void> =>
  Effect.sync(() => {
    for (const { noteId, edits } of registry.entries()) {
      const el = resolve(noteId);
      if (el !== null && el !== registry.elementOf(noteId)) registry.apply(noteId, el, edits);
    }
  });

/** Re-applies a note's edits when its target element was replaced by a page re-render. Observer lives as long as the scope. */
export const watchReapply = (
  registry: EditRegistry,
  doc: Document,
  resolve: (noteId: string) => Element | null,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.flatMap(observeChanges(doc), (changes) =>
    changes.pipe(
      Stream.debounce(REAPPLY_DEBOUNCE),
      Stream.runForEach(() => reapplyChanged(registry, resolve)),
      Effect.forkScoped,
      Effect.asVoid,
    ),
  );
