import * as fs from 'fs';

import { Builder } from './Builder';
import { ConfigPlugin } from './ConfigPlugin';
import ConfigRc from './configRc';
import AngularPlugin from './plugins/AngularPlugin';
import ApolloPlugin from './plugins/ApolloPlugin';
import CssProcessorPlugin from './plugins/CssProcessorPlugin';
import ES6Plugin from './plugins/ES6Plugin';
import FlowRuntimePLugin from './plugins/FlowRuntimePlugin';
import ReactHotLoaderPlugin from './plugins/ReactHotLoaderPlugin';
import ReactNativePlugin from './plugins/ReactNativePlugin';
import ReactNativeWebPlugin from './plugins/ReactNativeWebPlugin';
import ReactPlugin from './plugins/ReactPlugin';
import StyledComponentsPlugin from './plugins/StyledComponentsPlugin';
import TCombPlugin from './plugins/TCombPlugin';
import TypeScriptPlugin from './plugins/TypeScriptPlugin';
import VuePlugin from './plugins/VuePlugin';
import WebAssetsPlugin from './plugins/WebAssetsPlugin';
import WebpackPlugin from './plugins/WebpackPlugin';
import requireModule from './requireModule';
import Spin from './Spin';
import Stack from './Stack';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = (cmd, argv, builderName?) => {
  const builders = {};

  const plugins = [
    new WebpackPlugin(),
    new WebAssetsPlugin(),
    new CssProcessorPlugin(),
    new ApolloPlugin(),
    new TypeScriptPlugin(),
    new ES6Plugin(),
    new ReactPlugin(),
    new ReactHotLoaderPlugin(),
    new TCombPlugin(),
    new FlowRuntimePLugin(),
    new ReactNativePlugin(),
    new ReactNativeWebPlugin(),
    new StyledComponentsPlugin(),
    new AngularPlugin(),
    new VuePlugin()
  ];
  const config = new ConfigRc(plugins, argv);
  const overridesConfig = config.options.overridesConfig || WEBPACK_OVERRIDES_NAME;
  const overrides = fs.existsSync(overridesConfig) ? requireModule('./' + overridesConfig) : {};
  const spin = new Spin(cmd, config.builders, config.options, overrides.dependencyPlatforms || {});

  for (const name of Object.keys(config.builders)) {
    const builder = config.builders[name];
    const stack = builder.stack;

    if (name !== builderName && (builder.enabled === false || builder.roles.indexOf(cmd) < 0)) {
      continue;
    }

    if (spin.options.webpackDll && !stack.hasAny('server') && !builderName) {
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
    config.plugins.forEach((plugin: ConfigPlugin) => plugin.configure(builder, spin));

    const strategy = {
      entry: 'replace'
    };
    if (overrides[name]) {
      builder.config = spin.mergeWithStrategy(strategy, builder.config, overrides[name]);
    }
    if (builder.webpackConfig) {
      builder.config = spin.mergeWithStrategy(strategy, builder.config, builder.webpackConfig);
    }
  }

  return { builders, options: spin.options };
};

export default createConfig;
