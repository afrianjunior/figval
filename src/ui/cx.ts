export type ClassValue = string | false | null | undefined;

export const cx = (...parts: readonly ClassValue[]): string => parts.filter(Boolean).join(' ');
