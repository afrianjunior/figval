import { Context, Effect, Layer, Ref } from 'effect';
import {
  makeNoteId,
  makeSessionId,
  makeShotId,
  type NoteId,
  type SessionId,
  type ShotId,
} from '../domain';

export interface IdsService {
  readonly noteId: Effect.Effect<NoteId>;
  readonly shotId: Effect.Effect<ShotId>;
  readonly sessionId: Effect.Effect<SessionId>;
}

export class Ids extends Context.Tag('figval/platform/Ids')<Ids, IdsService>() {}

const cryptoBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const cryptoUnit = (): number => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32;

export const IdsLive: Layer.Layer<Ids> = Layer.succeed(Ids, {
  noteId: Effect.sync(() => makeNoteId(cryptoBytes)),
  shotId: Effect.sync(() => makeShotId(cryptoBytes)),
  sessionId: Effect.sync(() => makeSessionId(cryptoUnit)),
});

const counterBytes = (counter: number) => (n: number) => {
  const bytes = new Uint8Array(n);
  new DataView(bytes.buffer).setUint32(n - 4, counter);
  return bytes;
};

const counterRng = (counter: number): (() => number) => {
  let call = 0;
  return () => {
    const step = (counter * 7 + call * 11) % 36;
    call += 1;
    return (step + 0.5) / 36;
  };
};

/** Deterministic ids: the nth call of each kind yields the same value every run. */
export const IdsSequence: Layer.Layer<Ids> = Layer.effect(
  Ids,
  Effect.gen(function* () {
    const counter = yield* Ref.make(0);
    const next = Ref.getAndUpdate(counter, (n) => n + 1).pipe(Effect.map((n) => n + 1));
    return {
      noteId: Effect.map(next, (n) => makeNoteId(counterBytes(n))),
      shotId: Effect.map(next, (n) => makeShotId(counterBytes(n))),
      sessionId: Effect.map(next, (n) => makeSessionId(counterRng(n))),
    } satisfies IdsService;
  }),
);
