import * as minilog from 'minilog';

import createConfig from './createConfig';

minilog.enable();
const logger = minilog('spin');

export default (cwd, configPath, builderName) => {
  let builder;
  try {
    const builders = createConfig(cwd, 'watch', { c: configPath }, builderName).builders;
    for (const builderId of Object.keys(builders)) {
      if (builders[builderId].name === builderName) {
        builder = builders[builderId];
        break;
      }
    }
  } catch (e) {
    if (e.cause) {
      logger.error(e);
    }
    throw e;
  }
  if (!builder) {
    throw new Error(`Builder ${builderName} not found, cwd: ${cwd}, config path: ${configPath}`);
  }
  return builder.config;
};
