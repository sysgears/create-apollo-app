import createConfig from './createConfig';

const config = createConfig('test').nodes;

export default config[Object.keys(config)[0]].config;
