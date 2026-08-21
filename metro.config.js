const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle binary model files (ggml Whisper + Silero VAD).
config.resolver.assetExts.push('bin');

const whisperRealtime = {
  'whisper.rn/src/realtime-transcription': path.resolve(
    __dirname,
    'node_modules/whisper.rn/src/realtime-transcription/index.ts',
  ),
  'whisper.rn/src/realtime-transcription/types': path.resolve(
    __dirname,
    'node_modules/whisper.rn/src/realtime-transcription/types.ts',
  ),
  'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter': path.resolve(
    __dirname,
    'node_modules/whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter.ts',
  ),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const mapped = whisperRealtime[moduleName];
  if (mapped) {
    return { type: 'sourceFile', filePath: mapped };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
