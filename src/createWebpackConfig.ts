import createConfig from './createConfig';

export default (cwd, configPath, builderName) => {
  const config = createConfig('watch', cwd, { c: configPath }, builderName).builders;
  return config[builderName].config;
};
