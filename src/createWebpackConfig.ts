import createConfig from './createConfig';

export default (configPath, builderName) => {
  const config = createConfig('watch', { c: configPath }, builderName).builders;
  return config[builderName].config;
};
