import createConfig from './createConfig';

const config = createConfig('test', {}).builders;
const testConfig = config[Object.keys(config)[0]].config;

// console.log("test config:", require('util').inspect(testConfig, false, null));
export default testConfig;
