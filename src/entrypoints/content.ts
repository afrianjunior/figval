import { browser } from 'wxt/browser';
import { main } from '../content/main';

export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  main(ctx) {
    main({ resolveAsset: (path) => browser.runtime.getURL(path as never) }, (cb) =>
      ctx.onInvalidated(cb),
    );
  },
});
