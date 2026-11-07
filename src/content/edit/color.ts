const NAMED: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  orange: '#FFA500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  silver: '#C0C0C0',
  maroon: '#800000',
  navy: '#000080',
  teal: '#008080',
  lime: '#00FF00',
  aqua: '#00FFFF',
  cyan: '#00FFFF',
  fuchsia: '#FF00FF',
  magenta: '#FF00FF',
  pink: '#FFC0CB',
  brown: '#A52A2A',
};

const hex2 = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

const fromChannels = (r: number, g: number, b: number, a: number): string =>
  a >= 1
    ? `#${hex2(r)}${hex2(g)}${hex2(b)}`
    : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;

const parseHex = (s: string): string | null => {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (!m?.[1]) return null;
  const raw = m[1];
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join('') : raw;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return fromChannels(r, g, b, a);
};

const channel = (token: string): number =>
  token.endsWith('%') ? (parseFloat(token) / 100) * 255 : parseFloat(token);

const parseRgb = (s: string): string | null => {
  const m = /^rgba?\(\s*([^)]+)\)$/i.exec(s);
  if (!m?.[1]) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const [r, g, b] = parts.slice(0, 3).map(channel) as [number, number, number];
  const alphaToken = parts[3];
  const a =
    alphaToken === undefined
      ? 1
      : alphaToken.endsWith('%')
        ? parseFloat(alphaToken) / 100
        : parseFloat(alphaToken);
  return [r, g, b, a].some(Number.isNaN) ? null : fromChannels(r, g, b, a);
};

/** Normalizes a CSS color to uppercase #RRGGBB; keeps an rgba() string when alpha < 1. Unknown input is returned unchanged. */
export const toHex = (cssColor: string): string => {
  const s = cssColor.trim().toLowerCase();
  if (s === 'transparent') return 'rgba(0, 0, 0, 0)';
  return parseHex(s) ?? parseRgb(s) ?? NAMED[s] ?? cssColor.trim();
};

export const isOpaqueHex = (value: string): boolean => /^#[0-9A-F]{6}$/.test(value);
