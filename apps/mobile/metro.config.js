const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/**
 * Web (Next) installs React 19 at the repo root; mobile needs React 18.3.1.
 * Mixed copies → Hermes "TypeError: property is not writable" and a white screen.
 * Force Metro to always resolve React / RN from apps/mobile.
 */
const reactDir = path.dirname(
  require.resolve('react/package.json', { paths: [projectRoot] }),
);
const rnDir = path.dirname(
  require.resolve('react-native/package.json', { paths: [projectRoot] }),
);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: reactDir,
  'react-native': rnDir,
  'react-native-svg': path.dirname(
    require.resolve('react-native-svg/package.json', { paths: [projectRoot] }),
  ),
  'react-native-reanimated': path.dirname(
    require.resolve('react-native-reanimated/package.json', { paths: [projectRoot] }),
  ),
  '@shopify/react-native-skia': path.dirname(
    require.resolve('@shopify/react-native-skia/package.json', {
      paths: [projectRoot],
    }),
  ),
};

// Prefer the "react-native" package field (Skia ships src/ there). Missing this
// in monorepos often loads the wrong build → SkiaDomView "View config" errors.
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin every react/* and scheduler copy — duplicate React 18s still crash Hermes
  // with "TypeError: property is not writable" in this monorepo.
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'scheduler' || moduleName.startsWith('scheduler/')) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react-native') {
    return {
      filePath: require.resolve('react-native', { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  // Keep native-module JS in lockstep with Expo Go / prebuild binaries.
  if (
    moduleName === 'react-native-svg' ||
    moduleName.startsWith('react-native-svg/')
  ) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  if (typeof upstream === 'function') {
    return upstream(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
