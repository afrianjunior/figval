import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__fixtures__/**',
        'src/entrypoints/**',
        '**/*.d.ts',
        'src/**/test-kit.ts',
        'src/**/store-kit.ts',
        'src/**/test-support.{ts,tsx}',
        'src/**/test-harness.ts',
        'src/**/fixtures.ts',
        'src/platform/fake-chrome.ts',
      ],
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'text', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        'src/domain/**': { lines: 90 },
        'src/markdown/**': { lines: 90 },
        'src/locator/**': { lines: 85 },
        'src/storage/**': { lines: 85 },
        'src/messaging/**': { lines: 80 },
        'src/platform/**': { lines: 80 },
        'src/background/**': { lines: 80 },
        'src/content/edit/**': { lines: 85 },
        'src/sidepanel/model/**': { lines: 85 },
      },
    },
  },
});
