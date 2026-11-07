import tokens from './tokens.css?inline';
import base from './base.css?inline';
import controls from './controls.css?inline';
import composite from './composite.css?inline';
import overlay from './overlay.css?inline';

/** Tokens + primitives as one string, for injection into a Shadow DOM root. */
export const uiCss: string = [tokens, base, controls, composite, overlay].join('\n');
