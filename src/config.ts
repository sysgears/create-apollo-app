import requireModule from './requireModule';
import generateConfig from './generator';

const pkg = requireModule('./package.json');
const spinConfig = pkg.spin;

const createConfig = cmd => {
  let config = {};

  for (let preset of Object.keys(spinConfig.presets)) {
    if (spinConfig.presets[preset]) {
      const watch = cmd === 'watch';
      config[preset] = generateConfig(preset, watch, spinConfig.options, {});
    }
  }

  return config;
};

export default createConfig;

