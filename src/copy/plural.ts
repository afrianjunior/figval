export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const count = (n: number, one: string, many: string): string => `${n} ${plural(n, one, many)}`;
