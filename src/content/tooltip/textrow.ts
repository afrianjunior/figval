import { Effect, ExecutionStrategy, Exit, Scope, Stream } from 'effect';
import { startTextEdit } from '../edit';

export interface TextRow {
  /** Makes the page element editable and streams its typing into `onText`. */
  readonly activate: (el: Element, onText: (value: string) => void) => Effect.Effect<void>;
  readonly deactivate: Effect.Effect<void>;
}

/** One text-edit session at a time, forked from the tooltip scope so it dies with it. */
export const makeTextRow = (parent: Scope.Scope): Effect.Effect<TextRow> =>
  Effect.sync(() => {
    let child: Scope.CloseableScope | null = null;

    const deactivate = Effect.suspend(() => {
      const open = child;
      child = null;
      return open ? Scope.close(open, Exit.void) : Effect.void;
    });

    const activate: TextRow['activate'] = (el, onText) =>
      Effect.gen(function* () {
        yield* deactivate;
        const scope = yield* Scope.fork(parent, ExecutionStrategy.sequential);
        child = scope;
        const session = yield* startTextEdit(el).pipe(Scope.extend(scope));
        yield* Stream.runForEach(session.onInput, (v) => Effect.sync(() => onText(v))).pipe(
          Effect.forkIn(scope),
        );
      });

    return { activate, deactivate };
  });
