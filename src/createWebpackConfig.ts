import createConfig from './createConfig';

export default (configPath, builderName) => {
  const config = createConfig('watch', { c: configPath }).builders;
  return config[builderName].config;
};
