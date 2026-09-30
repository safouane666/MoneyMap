const { getRandomValues } = require('expo-crypto');

// Hermes has no Web Crypto; domain IDs need getRandomValues when saving txns.
const g = globalThis;
if (!g.crypto) {
  g.crypto = {};
}
if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = getRandomValues;
}

require('react-native-url-polyfill/auto');
require('expo-router/entry');
