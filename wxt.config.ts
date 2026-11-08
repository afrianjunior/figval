import { defineConfig } from 'wxt';

// Exported from design/logo-proposals/figval-logo-a.figcraft (frame "Figval logo A / 128").
const ICONS = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
};

export default defineConfig({
  srcDir: 'src',
  outDir: '.output',
  outDirTemplate: '{{browser}}-mv3{{modeSuffix}}',
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // WXT derives host_permissions from the runtime content script matches; §9 forbids them in production.
      if (wxt.config.mode !== 'test') delete manifest.host_permissions;
    },
  },
  manifest: ({ mode }) => ({
    name: 'Figval',
    // Chrome Web Store summary: max 132 characters.
    description:
      'Comment on elements of a live page, then export your notes as Markdown for a teammate or a coding agent.',
    permissions: [
      'sidePanel',
      'activeTab',
      'scripting',
      'storage',
      'unlimitedStorage',
      'downloads',
    ],
    optional_host_permissions: ['<all_urls>'],
    ...(mode === 'test' ? { host_permissions: ['<all_urls>'] } : {}),
    icons: ICONS,
    action: { default_title: 'Figval', default_icon: ICONS },
    commands: {
      pick: {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Pick an element on the page',
      },
    },
    web_accessible_resources: [{ resources: ['fonts/*', 'assets/*'], matches: ['<all_urls>'] }],
  }),
});
