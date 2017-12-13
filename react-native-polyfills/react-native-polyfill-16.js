require('react-native/Libraries/polyfills/Object.es6.js');
require('react-native/Libraries/polyfills/console.js');
require('react-native/Libraries/polyfills/error-guard.js');
require('react-native/Libraries/polyfills/Number.es6.js');
require('react-native/Libraries/polyfills/String.prototype.es6.js');
require('react-native/Libraries/polyfills/Array.prototype.es6.js');
require('react-native/Libraries/polyfills/Array.es6.js');
require('react-native/Libraries/polyfills/Object.es7.js');
require('react-native/Libraries/polyfills/babelHelpers.js');

global.__DEV__ = __DEV__;
global.__BUNDLE_START_TIME__ = global.nativePerformanceNow ? global.nativePerformanceNow() : Date.now();

if (!global.self) {
  global.self = global;
}
require('react-native/Libraries/Core/InitializeCore.js');
