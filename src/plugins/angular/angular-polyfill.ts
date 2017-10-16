import 'core-js/es6';
import 'core-js/es7/reflect';
import 'zone.js/dist/zone';

if (process.env.ENV === 'production') {
  // Production
} else {
  // Development and test
  Error.stackTraceLimit = Infinity;
  /* tslint:disable:no-var-requires */
  require('zone.js/dist/long-stack-trace-zone');
}
