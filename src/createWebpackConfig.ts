import createConfig from './createConfig';

export default (cwd, configPath, builderName) => {
  const config = createConfig(cwd, 'watch', { c: configPath }, builderName).builders;
  if (!config[builderName]) {
    throw new Error(`Builder ${builderName} not found, cwd: ${cwd}, config path: ${configPath}`);
  }
  return config[builderName].config;
};
