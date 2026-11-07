import { Effect, type Scope } from 'effect';
import { buildFontFaceCss, uiCss } from '../../ui';
import overlayCss from './overlay.css?inline';

export const HOST_TAG = 'figval-root';
export const FONT_STYLE_ID = 'figval-fonts';

export interface OverlayHost {
  readonly host: HTMLElement;
  readonly root: ShadowRoot;
  /** `.fv-root` element every overlay node lives in. */
  readonly layer: HTMLElement;
  readonly setHidden: (hidden: boolean) => void;
  readonly isHidden: () => boolean;
  /** True when the event came from inside the Figval host (events are retargeted to the host). */
  readonly owns: (event: Event) => boolean;
}

export interface OverlayHostOptions {
  readonly doc: Document;
  /** Maps an emitted asset path to a loadable URL; provided by the entrypoint. */
  readonly resolveAsset: (path: string) => string;
}

const HOST_STYLE = [
  'all: initial',
  'position: fixed',
  'inset: 0',
  'z-index: 2147483647',
  'pointer-events: none',
].join(';');

const injectFonts = (
  doc: Document,
  resolveAsset: (path: string) => string,
): HTMLStyleElement | null => {
  if (doc.getElementById(FONT_STYLE_ID)) return null;
  const style = doc.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = buildFontFaceCss(resolveAsset);
  (doc.head ?? doc.documentElement).append(style);
  return style;
};

const build = (doc: Document): { host: HTMLElement; root: ShadowRoot; layer: HTMLElement } => {
  const host = doc.createElement(HOST_TAG);
  host.setAttribute('data-fv-host', '');
  host.setAttribute('style', HOST_STYLE);
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `${uiCss}\n${overlayCss}`;
  const layer = doc.createElement('div');
  layer.className = 'fv-root fv-ov-layer';
  root.append(style, layer);
  doc.documentElement.append(host);
  return { host, root, layer };
};

export const acquireOverlayHost = (
  options: OverlayHostOptions,
): Effect.Effect<OverlayHost, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const { doc, resolveAsset } = options;
      const fonts = injectFonts(doc, resolveAsset);
      const parts = build(doc);
      const host: OverlayHost = {
        ...parts,
        setHidden: (hidden) => {
          parts.host.style.display = hidden ? 'none' : '';
        },
        isHidden: () => parts.host.style.display === 'none',
        owns: (event) => event.target === parts.host || event.composedPath().includes(parts.host),
      };
      return { host, fonts };
    }),
    ({ host, fonts }) =>
      Effect.sync(() => {
        host.host.remove();
        fonts?.remove();
      }),
  ).pipe(Effect.map(({ host }) => host));
