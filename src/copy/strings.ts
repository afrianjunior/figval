import { errors } from './errors';
import { markdownHuman } from './human';
import { panel } from './panel';
import { keys, picker, toasts, tooltip } from './tooltip';

export { ERROR_TAGS, type ErrorTag } from './errors';

export const copy = { panel, tooltip, picker, keys, errors, toasts, markdownHuman } as const;

export type Copy = typeof copy;
