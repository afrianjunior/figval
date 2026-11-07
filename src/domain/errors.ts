import { Schema } from 'effect';
import { NoteId, TabId } from './ids';

export class StorageQuotaExceeded extends Schema.TaggedError<StorageQuotaExceeded>()(
  'StorageQuotaExceeded',
  { bytesInUse: Schema.Number },
) {}

export class StorageCorrupt extends Schema.TaggedError<StorageCorrupt>()('StorageCorrupt', {
  key: Schema.String,
  issue: Schema.String,
}) {}

export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()(
  'StorageUnavailable',
  { cause: Schema.Unknown },
) {}

export class ShotStoreError extends Schema.TaggedError<ShotStoreError>()('ShotStoreError', {
  op: Schema.String,
  cause: Schema.Unknown,
}) {}

export class UnsupportedPage extends Schema.TaggedError<UnsupportedPage>()('UnsupportedPage', {
  url: Schema.String,
}) {}

export class PermissionDenied extends Schema.TaggedError<PermissionDenied>()('PermissionDenied', {
  origin: Schema.String,
}) {}

export class InjectionFailed extends Schema.TaggedError<InjectionFailed>()('InjectionFailed', {
  tabId: TabId,
  cause: Schema.Unknown,
}) {}

export class CaptureFailed extends Schema.TaggedError<CaptureFailed>()('CaptureFailed', {
  reason: Schema.String,
}) {}

export class ElementNotFound extends Schema.TaggedError<ElementNotFound>()('ElementNotFound', {
  noteId: NoteId,
}) {}

export class ClipboardDenied extends Schema.TaggedError<ClipboardDenied>()('ClipboardDenied', {
  cause: Schema.Unknown,
}) {}

export class MessageTimeout extends Schema.TaggedError<MessageTimeout>()('MessageTimeout', {
  type: Schema.String,
  ms: Schema.Number,
}) {}

export class MessageDecodeError extends Schema.TaggedError<MessageDecodeError>()(
  'MessageDecodeError',
  { type: Schema.String, issue: Schema.String },
) {}

/** Defect: use with Effect.die, never in an E channel. */
export class InvariantViolation extends Schema.TaggedError<InvariantViolation>()(
  'InvariantViolation',
  { what: Schema.String },
) {}

/** Error scoped to the NoteService layer; deeper errors are folded into `reason`. */
export class NoteSaveError extends Schema.TaggedError<NoteSaveError>()('NoteSaveError', {
  reason: Schema.String,
}) {}

export type ErrorTag =
  | 'StorageQuotaExceeded'
  | 'StorageCorrupt'
  | 'StorageUnavailable'
  | 'ShotStoreError'
  | 'UnsupportedPage'
  | 'PermissionDenied'
  | 'InjectionFailed'
  | 'CaptureFailed'
  | 'ElementNotFound'
  | 'ClipboardDenied'
  | 'MessageTimeout'
  | 'MessageDecodeError'
  | 'InvariantViolation'
  | 'NoteSaveError';

export type DomainError =
  | StorageQuotaExceeded
  | StorageCorrupt
  | StorageUnavailable
  | ShotStoreError
  | UnsupportedPage
  | PermissionDenied
  | InjectionFailed
  | CaptureFailed
  | ElementNotFound
  | ClipboardDenied
  | MessageTimeout
  | MessageDecodeError
  | InvariantViolation
  | NoteSaveError;
