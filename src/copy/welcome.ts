/** Welcome tab, opened once on install. */
export const welcome = {
  pageTitle: 'Welcome to Figval',
  eyebrow: 'Installed',
  title: 'Comment on the live page, then export it as Markdown',
  lede: 'Click an element and write what should change. Figval collects your notes into Markdown that a teammate or a coding agent can work from. Setup has three steps.',
  privacy: "Notes and screenshots are stored in this browser. Figval doesn't upload them.",
  progress: (done: number, total: number): string => `${done} of ${total} done`,
  stepDone: 'Done',
  pin: {
    title: 'Pin Figval to the toolbar',
    body: 'Click the puzzle piece next to the address bar, then the pin beside Figval. You start Figval on a page from that icon.',
    pinned: 'Figval is pinned next to the address bar.',
  },
  role: {
    title: 'How will you use it?',
    legend: 'Choose a preset',
    hint: 'You can change this later in Settings.',
    reviewer: {
      label: 'Reviewer',
      body: 'Comment on what should change. New notes open on the Comment tab.',
    },
    developer: {
      label: 'Developer',
      body: 'Edit text and styles in place. New notes open on the tab you used last.',
    },
    saveFailed: "Couldn't save your choice. Try again.",
  },
  tryIt: {
    title: 'Try it on a real page',
    body: "Figval can't run on Chrome's own pages, including this one. Open any website, then click the Figval icon or press",
    noShortcut: "Chrome didn't assign a shortcut, usually because another extension already uses it.",
    setShortcut: 'Set a shortcut',
    sitePrompt: 'The first time you press Pick in the side panel on a site, Chrome asks whether Figval can access it.',
    openExample: 'Open an example page',
  },
} as const;

export const EXAMPLE_PAGE_URL = 'https://example.com/';
export const SHORTCUTS_URL = 'chrome://extensions/shortcuts';
