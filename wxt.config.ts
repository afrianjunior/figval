import { defineConfig } from 'wxt';

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
    action: { default_title: 'Figval' },
    commands: {
      pick: {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Pick an element on the page',
      },
    },
    web_accessible_resources: [{ resources: ['fonts/*', 'assets/*'], matches: ['<all_urls>'] }],
  }),
});
