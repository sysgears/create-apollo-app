import requireModule from './requireModule';
import createConfig from './generator';

const pkg = requireModule('./package.json');
const spinConfig = pkg.spin;

const createConfig = cmd => {
  let config = {};

  for (let preset of Object.keys(spinConfig.presets)) {
    if (spinConfig.presets[preset]) {
      config[preset] = createConfig();
      console.log("Found preset:", preset);
    }
  }
};

