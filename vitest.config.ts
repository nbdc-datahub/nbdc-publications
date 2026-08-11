import { defineConfig } from 'vitest/config';

// Two projects: node (data-prep pipeline, CSV/encoding logic) and dom (browser-side helpers).
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['scripts/**/*.test.ts', 'web/**/*.node.test.ts', 'tests/**/*.node.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['web/**/*.dom.test.ts', 'web/**/*.dom.test.tsx', 'web/lib/**/*.test.ts'],
          exclude: ['web/**/*.node.test.ts'],
        },
      },
    ],
  },
});
