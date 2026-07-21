import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/lib/__tests__/rtGeometry.test.ts',
      'src/**/__tests__/rtPt*.test.ts',
      'src/**/__tests__/RtPt*.test.ts',
      'src/electron/__tests__/*.test.ts',
    ],
  },
});
