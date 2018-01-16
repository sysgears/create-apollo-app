// TODO: remove in 0.5.x
import createConfig from './createConfig';

const builders = createConfig(process.env.SPIN_CWD || process.cwd(), 'test', { c: process.env.SPIN_CONFIG }).builders;
const testConfig = builders[Object.keys(builders)[0]].config;

// console.log("test config:", require('util').inspect(testConfig, false, null));
export default testConfig;
