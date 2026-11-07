import { Schema } from 'effect';

/** The remote handler replied `{ ok: false }`; `tag` is the remote error's tag. */
export class RemoteFailure extends Schema.TaggedError<RemoteFailure>()('RemoteFailure', {
  tag: Schema.String,
  message: Schema.optional(Schema.String),
}) {}
