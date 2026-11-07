import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interMedium from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import interSemibold from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import monoRegular from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';

export interface FontFace {
  readonly family: string;
  readonly weight: number;
  readonly file: string;
  readonly url: string;
}

export const fontFaces: readonly FontFace[] = [
  { family: 'Figval Inter', weight: 400, file: 'inter-latin-400-normal.woff2', url: interRegular },
  { family: 'Figval Inter', weight: 500, file: 'inter-latin-500-normal.woff2', url: interMedium },
  { family: 'Figval Inter', weight: 600, file: 'inter-latin-600-normal.woff2', url: interSemibold },
  {
    family: 'Figval JetBrains Mono',
    weight: 400,
    file: 'jetbrains-mono-latin-400-normal.woff2',
    url: monoRegular,
  },
];

export const fontUrls: readonly string[] = fontFaces.map((f) => f.url);

const faceRule = (face: FontFace, src: string): string =>
  `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};` +
  `font-display:swap;src:url('${src}') format('woff2');}`;

/**
 * `resolve` receives the emitted asset path of each font file (the `?url` value)
 * and returns the URL to embed, e.g. `chrome.runtime.getURL` in the tooltip.
 */
export const buildFontFaceCss = (resolve: (assetPath: string) => string): string =>
  fontFaces.map((face) => faceRule(face, resolve(face.url))).join('\n');
