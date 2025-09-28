const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for TypeScript files
config.resolver.sourceExts.push('ts', 'tsx');

// Fix for transform worker issue with new architecture
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Ensure proper module resolution
config.resolver.sourceExts.push('cjs');

// Enable async imports and dynamic imports
config.transformer.asyncRequireModulePath = require.resolve(
  'metro-runtime/src/modules/asyncRequire',
);

module.exports = config;
