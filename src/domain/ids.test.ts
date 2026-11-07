import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  NoteId, NoteSeq, SessionId, ShotId, TabId,
  formatSeq, makeSessionId, makeUuidV4,
} from './ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bytes = (fill: number) => (n: number) => new Uint8Array(n).fill(fill);

describe('SessionId', () => {
  it('decodes fv-xxxx', () => {
    expect(Schema.decodeUnknownSync(SessionId)('fv-7k2q')).toBe('fv-7k2q');
  });
  it.each(['fv-7K2q', 'fv-7k2', 'fv-7k2qq', 'xx-7k2q', '', 'fv-7k_q'])('rejects %s', (v) => {
    expect(() => Schema.decodeUnknownSync(SessionId)(v)).toThrow();
  });
  it('generates matching ids from rng', () => {
    expect(makeSessionId(() => 0)).toBe('fv-aaaa');
    expect(makeSessionId(() => 0.999999)).toBe('fv-9999');
    expect(Schema.is(SessionId)(makeSessionId(Math.random))).toBe(true);
  });
});

describe('uuid ids', () => {
  it('makeUuidV4 sets version and variant bits', () => {
    expect(makeUuidV4(bytes(0))).toBe('00000000-0000-4000-8000-000000000000');
    expect(makeUuidV4(bytes(255))).toMatch(UUID_V4);
  });
  it('NoteId and ShotId accept v4 only', () => {
    const id = makeUuidV4(bytes(7));
    expect(Schema.is(NoteId)(id)).toBe(true);
    expect(Schema.is(ShotId)(id)).toBe(true);
    expect(Schema.is(NoteId)('00000000-0000-1000-8000-000000000000')).toBe(false);
    expect(Schema.is(ShotId)('nope')).toBe(false);
  });
});

describe('NoteSeq and TabId', () => {
  it('NoteSeq is a positive int', () => {
    expect(Schema.is(NoteSeq)(1)).toBe(true);
    expect(Schema.is(NoteSeq)(0)).toBe(false);
    expect(Schema.is(NoteSeq)(1.5)).toBe(false);
  });
  it('TabId is a non-negative int', () => {
    expect(Schema.is(TabId)(0)).toBe(true);
    expect(Schema.is(TabId)(-1)).toBe(false);
    expect(Schema.is(TabId)(2.2)).toBe(false);
  });
  it('formatSeq renders FV-n', () => {
    expect(formatSeq(Schema.decodeSync(NoteSeq)(12))).toBe('FV-12');
  });
});
