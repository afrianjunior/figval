const UNSUPPORTED_PROTOCOLS: ReadonlySet<string> = new Set([
  'chrome:',
  'chrome-untrusted:',
  'chrome-extension:',
  'view-source:',
  'devtools:',
  'about:',
]);

const WEBSTORE_HOST = 'chromewebstore.google.com';
const LEGACY_WEBSTORE = { host: 'chrome.google.com', pathPrefix: '/webstore' };

/**
 * Pages Figval cannot run on (p.impl.md §9). The built-in PDF viewer is covered twice: its
 * `chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/` URL by the protocol rule, and http(s)/file
 * URLs whose path ends in `.pdf` (they open in that viewer).
 * An empty or unparsable URL (tab without access) is not judged unsupported; injection decides.
 */
export const unsupportedUrl = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (UNSUPPORTED_PROTOCOLS.has(parsed.protocol)) return true;
  if (parsed.hostname === WEBSTORE_HOST) return true;
  if (parsed.hostname === LEGACY_WEBSTORE.host && parsed.pathname.startsWith(LEGACY_WEBSTORE.pathPrefix)) {
    return true;
  }
  return parsed.pathname.toLowerCase().endsWith('.pdf');
};
