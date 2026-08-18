const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle binary model files (e.g., ggml-tiny.en.bin for whisper.rn)
config.resolver.assetExts.push('bin');

module.exports = config;
