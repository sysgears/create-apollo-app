import * as fs from 'fs';

import { Builder } from './Builder';
import ConfigRc from './configRc';
import plugins from './plugins';
import requireModule from './requireModule';
import Spin from './Spin';
import Stack from './Stack';
import { StackPlugin } from './StackPlugin';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
  const builders = {};

  const config = new ConfigRc(plugins);
  const overridesConfig = config.options.overridesConfig || WEBPACK_OVERRIDES_NAME;
  const overrides = fs.existsSync(overridesConfig) ? requireModule('./' + overridesConfig) : {};
  const spin = new Spin(cmd, config.builders, config.options, overrides.dependencyPlatforms || {});

  for (const name of Object.keys(config.builders)) {
    const builder = config.builders[name];
    const stack = builder.stack;

    if (builder.enabled === false || builder.roles.indexOf(cmd) < 0) {
      continue;
    }

    if (spin.options.webpackDll && !stack.hasAny('server')) {
      const dllBuilder: Builder = { ...builder };
      dllBuilder.name = builder.name + 'Dll';
      dllBuilder.parent = builder;
      dllBuilder.stack = new Stack(dllBuilder.stack.technologies, 'dll');
      builders[dllBuilder.name] = dllBuilder;
      builder.child = dllBuilder;
    }
    builders[name] = builder;
  }

  for (const name of Object.keys(builders)) {
    const builder = builders[name];
    config.plugins.forEach(
      (plugin: StackPlugin) => plugin.detect(builder, spin) && plugin.configure && plugin.configure(builder, spin)
    );
    if (overrides[name]) {
      builders[name].config = spin.mergeWithStrategy(
        {
          entry: 'replace'
        },
        builders[name].config,
        overrides[name]
      );
    }
  }

  return { builders, options: spin.options };
};

export default createConfig;
