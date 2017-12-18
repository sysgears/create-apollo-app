import createConfig from './createConfig';

const builders = createConfig('test', {}).builders;
let config;
for (const name of Object.keys(builders)) {
  const builder = builders[name];
  if (builder.enabled !== false && builder.roles.indexOf('test') >= 0) {
    config = builder.config;
    break;
  }
}

if (!config) {
  throw new Error('spin.js test config not found!');
}

// console.log("test config:", require('util').inspect(testConfig, false, null));
export default config;
