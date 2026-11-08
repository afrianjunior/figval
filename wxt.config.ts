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
    // Chrome Web Store title: max 75 characters. Keywords here weigh most in store search.
    name: 'Figval: Annotate Websites & Export Markdown for AI Agents',
    short_name: 'Figval',
    // Chrome Web Store summary: max 132 characters.
    description:
      'Click an element, comment or tweak its text and CSS, then export clean Markdown for Cursor, Claude Code or a teammate. No account.',
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
