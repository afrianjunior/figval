import { Effect, Either, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { contentTags, directionOf, replyEnvelope, replySchemaFor, replySchemas, Request, type RequestTag } from './protocol';
import { sampleReplyValues, sampleRequests } from './fixtures';

const tags = Object.keys(sampleRequests) as RequestTag[];

describe('protocol', () => {
  it('covers exactly the 22 messages of the spec', () => {
    expect(tags).toHaveLength(22);
    expect(Object.keys(replySchemas).sort()).toEqual([...tags].sort());
  });

  it.each(tags)('round-trips request %s through JSON', (tag) => {
    const encoded = Effect.runSync(Schema.encode(Request)(sampleRequests[tag]));
    const wire: unknown = JSON.parse(JSON.stringify(encoded));
    expect(Effect.runSync(Schema.decodeUnknown(Request)(wire))).toEqual(sampleRequests[tag]);
  });

  it.each(tags)('round-trips ok reply for %s through JSON', (tag) => {
    const envelope = replyEnvelope(replySchemaFor(tag));
    const encoded = Effect.runSync(Schema.encodeUnknown(envelope)({ ok: true, value: sampleReplyValues[tag] }));
    const wire: unknown = JSON.parse(JSON.stringify(encoded));
    const decoded = Effect.runSync(Schema.decodeUnknown(envelope)(wire));
    expect(decoded).toEqual({ ok: true, value: sampleReplyValues[tag] });
  });

  it('round-trips an error reply', () => {
    const envelope = replyEnvelope(replySchemaFor('NoteCreate'));
    const reply = { ok: false, error: { tag: 'NoteSaveError', message: 'boom' } } as const;
    expect(Effect.runSync(Schema.decodeUnknown(envelope)(reply))).toEqual(reply);
  });

  it.each([
    ['unknown tag', { _tag: 'Nope' }],
    ['missing field', { _tag: 'ScrollTo' }],
    ['bad note id', { _tag: 'ScrollTo', noteId: 'not-a-uuid' }],
    ['bad via', { _tag: 'ActivateTab', tabId: 1, via: 'telepathy' }],
    ['not an object', 'Ping'],
  ])('rejects %s', (_label, raw) => {
    expect(Either.isLeft(Schema.decodeUnknownEither(Request)(raw))).toBe(true);
  });

  it('rejects a reply that is neither ok nor error', () => {
    const envelope = replyEnvelope(replySchemaFor('Ping'));
    expect(Either.isLeft(Schema.decodeUnknownEither(envelope)({ ok: true, value: { pong: false } }))).toBe(true);
    expect(Either.isLeft(Schema.decodeUnknownEither(envelope)({ ok: 'maybe' }))).toBe(true);
  });

  it('routes the 12 content messages to content and the rest to background', () => {
    expect(contentTags).toHaveLength(12);
    for (const tag of tags) {
      expect(directionOf(tag)).toBe((contentTags as readonly string[]).includes(tag) ? 'toContent' : 'toBackground');
    }
  });
});
