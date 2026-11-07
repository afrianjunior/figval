import { Schema } from 'effect';

const SESSION_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SESSION_SUFFIX_LENGTH = 4;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const SessionId = Schema.String.pipe(Schema.pattern(/^fv-[a-z0-9]{4}$/), Schema.brand('SessionId'));
export type SessionId = typeof SessionId.Type;

export const NoteId = Schema.String.pipe(Schema.pattern(UUID_V4_PATTERN), Schema.brand('NoteId'));
export type NoteId = typeof NoteId.Type;

export const ShotId = Schema.String.pipe(Schema.pattern(UUID_V4_PATTERN), Schema.brand('ShotId'));
export type ShotId = typeof ShotId.Type;

export const NoteSeq = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('NoteSeq'));
export type NoteSeq = typeof NoteSeq.Type;

export const TabId = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('TabId'));
export type TabId = typeof TabId.Type;

export const makeSessionId = (rng: () => number): SessionId => {
  let suffix = '';
  for (let i = 0; i < SESSION_SUFFIX_LENGTH; i += 1) {
    const index = Math.min(SESSION_ALPHABET.length - 1, Math.floor(rng() * SESSION_ALPHABET.length));
    suffix += SESSION_ALPHABET.charAt(index);
  }
  return Schema.decodeSync(SessionId)(`fv-${suffix}`);
};

const hex = (byte: number): string => byte.toString(16).padStart(2, '0');

export const makeUuidV4 = (randomBytes: (n: number) => Uint8Array): string => {
  const raw = Array.from(randomBytes(16));
  const b = raw.map((v, i) => (i === 6 ? (v & 0x0f) | 0x40 : i === 8 ? (v & 0x3f) | 0x80 : v));
  const h = b.map(hex);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
};

export const makeNoteId = (randomBytes: (n: number) => Uint8Array): NoteId =>
  Schema.decodeSync(NoteId)(makeUuidV4(randomBytes));

export const makeShotId = (randomBytes: (n: number) => Uint8Array): ShotId =>
  Schema.decodeSync(ShotId)(makeUuidV4(randomBytes));

export const formatSeq = (seq: NoteSeq): string => `FV-${seq}`;
