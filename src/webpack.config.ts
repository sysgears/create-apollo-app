import createConfig from './createConfig';

const config = createConfig('test').builders;

export default config[Object.keys(config)[0]].config;
