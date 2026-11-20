// Metro (bundler for the app and the website): Expo's defaults, plus one size fix.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zod's main entries (v4/classic and v4/core) re-export every language's error messages (z.locales).
// Nothing here uses them, so bundles get an empty module instead (src/lib/zodLocales.js).
const zodLocalesStub = path.join(__dirname, 'src', 'lib', 'zodLocales.js');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    /^\.\.\/locales\/index\.c?js$/.test(moduleName) &&
    /[\\/]node_modules[\\/]zod[\\/]v4[\\/](classic|core)[\\/]/.test(context.originModulePath)
  ) {
    return { type: 'sourceFile', filePath: zodLocalesStub };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
