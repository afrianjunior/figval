import type { SessionId } from '../domain';

export const SETTINGS_KEY = 'settings';
export const SESSIONS_KEY = 'sessions';

export const notesKey = (sessionId: SessionId): string => `notes:${sessionId}`;

export const storageKeys = {
  settings: SETTINGS_KEY,
  sessions: SESSIONS_KEY,
  notes: notesKey,
} as const;
