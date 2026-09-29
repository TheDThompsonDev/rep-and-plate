const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../node_modules')];
// Shared hooks must use the native app's React instance, not the web copy.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

