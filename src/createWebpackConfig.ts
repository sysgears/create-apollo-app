import createConfig from './createConfig';

export default (configPath, builderName) => {
  const config = createConfig('watch', { c: configPath }).builders;
  if (!config[builderName]) {
    throw new Error(`Spin.js builder '${builderName}' doesn't exist`);
  }
  return config[builderName].config;
};
