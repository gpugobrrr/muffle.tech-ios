import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      {
        find: 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter',
        replacement: path.resolve(
          __dirname,
          'node_modules/whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter.ts',
        ),
      },
      {
        find: 'whisper.rn/src/realtime-transcription/types',
        replacement: path.resolve(
          __dirname,
          'node_modules/whisper.rn/src/realtime-transcription/types.ts',
        ),
      },
      {
        find: 'whisper.rn/src/realtime-transcription',
        replacement: path.resolve(
          __dirname,
          'node_modules/whisper.rn/src/realtime-transcription/index.ts',
        ),
      },
      {
        find: 'whisper.rn',
        replacement: path.resolve(
          __dirname,
          'node_modules/whisper.rn/lib/commonjs/index.js',
        ),
      },
      {
        find: '@fugood/react-native-audio-pcm-stream',
        replacement: path.resolve(
          __dirname,
          'tests/mocks/react-native-audio-pcm-stream.ts',
        ),
      },
      {
        find: 'expo-asset',
        replacement: path.resolve(
          __dirname,
          'node_modules/expo-asset/build/index.js',
        ),
      },
      { find: 'react-native', replacement: 'react-native-web' },
    ],
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
      'tests/realtime-streaming.test.ts',
    ],
  },
});
