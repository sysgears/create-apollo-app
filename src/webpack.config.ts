import createConfig from './createConfig';

const config = createConfig('test').config;

export default config[Object.keys(config)[0]];
