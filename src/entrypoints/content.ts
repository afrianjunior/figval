import { main } from '../content/main';

export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  main() {
    main();
  },
});
