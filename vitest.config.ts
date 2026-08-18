import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react-native': 'react-native-web',
      // whisper.rn has no root '.' export specifier; point Vite at the CJS build.
      // vi.mock() intercepts before any native code runs, so the alias only
      // needs to let Vite resolve the module path during collection.
      'whisper.rn': path.resolve(__dirname, 'node_modules/whisper.rn/lib/commonjs/index.js'),
      // expo-asset is a native module — aliased to its compiled JS so Vite
      // can resolve it; vi.mock() replaces it before any native calls.
      'expo-asset': path.resolve(__dirname, 'node_modules/expo-asset/build/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'tests/**/*.e2e.test.ts',
      'tests/voice-*.test.ts',
      'tests/finding-*.test.ts',
      'tests/offline-normalization.test.ts',
      'tests/ontology-hud.test.ts',
      'tests/audio-recording-pipeline.test.ts',
      'tests/golden-zone-ptt.test.tsx',
      'tests/command-dock.test.tsx',
      'tests/active-finding-focus.test.tsx',
      'tests/offline-whisper.test.ts',
    ],
  },
});
