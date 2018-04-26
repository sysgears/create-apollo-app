import * as cluster from 'cluster';
import * as fs from 'fs';
import * as minilog from 'minilog';

import { Builder } from './Builder';
import BuilderDiscoverer from './BuilderDiscoverer';
import { ConfigPlugin } from './ConfigPlugin';
import AngularPlugin from './plugins/AngularPlugin';
import ApolloPlugin from './plugins/ApolloPlugin';
import BabelPlugin from './plugins/BabelPlugin';
import CssProcessorPlugin from './plugins/CssProcessorPlugin';
import FlowRuntimePLugin from './plugins/FlowRuntimePlugin';
import I18NextPlugin from './plugins/I18NextPlugin';
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
import Spin from './Spin';
import Stack from './Stack';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const spinLogger = minilog('spin');

const createConfig = (cwd: string, cmd: string, argv: any, builderName?: string) => {
  const builders = {};

  const plugins = [
    new WebpackPlugin(),
    new WebAssetsPlugin(),
    new CssProcessorPlugin(),
    new ApolloPlugin(),
    new TypeScriptPlugin(),
    new BabelPlugin(),
    new ReactPlugin(),
    new ReactHotLoaderPlugin(),
    new TCombPlugin(),
    new FlowRuntimePLugin(),
    new ReactNativePlugin(),
    new ReactNativeWebPlugin(),
    new StyledComponentsPlugin(),
    new AngularPlugin(),
    new VuePlugin(),
    new I18NextPlugin()
  ];
  const spin = new Spin(cwd, cmd);
  const builderDiscoverer = new BuilderDiscoverer(spin, plugins, argv);
  const role = cmd === 'exp' ? 'build' : cmd;

  const discoveredBuilders = builderDiscoverer.discover() || {};
  if (!discoveredBuilders) {
    throw new Error('Cannot find spinjs config');
  }
  if (cluster.isMaster && argv.verbose) {
    spinLogger.log('SpinJS Config:\n', require('util').inspect(discoveredBuilders, false, null));
  }

  for (const builderId of Object.keys(discoveredBuilders)) {
    const builder = discoveredBuilders[builderId];
    const stack = builder.stack;

    if (builder.name !== builderName && (builder.enabled === false || builder.roles.indexOf(role) < 0)) {
      continue;
    }

    if (spin.dev && builder.webpackDll && !stack.hasAny('server') && !builderName) {
      const dllBuilder: Builder = { ...builder };
      dllBuilder.name = builder.name + 'Dll';
      dllBuilder.require = builder.require;
      dllBuilder.parent = builder;
      dllBuilder.stack = new Stack(dllBuilder.stack.technologies, 'dll');
      builders[`${builderId.split('[')[0]}[${builder.name}Dll]`] = dllBuilder;
      builder.child = dllBuilder;
    }
    builders[builderId] = builder;
  }

  for (const builderId of Object.keys(builders)) {
    const builder = builders[builderId];
    const overridesConfig = builder.overridesConfig || WEBPACK_OVERRIDES_NAME;
    const overrides = fs.existsSync(overridesConfig) ? builder.require('./' + overridesConfig) : {};

    builder.depPlatforms = overrides.dependencyPlatforms || builder.depPlatforms || {};
    builder.dllExcludes = builder.dllExcludes || [];
    builder.plugins.forEach((plugin: ConfigPlugin) => plugin.configure(builder, spin));

    const strategy = {
      entry: 'replace',
      stats: 'replace'
    };
    if (overrides[builder.name]) {
      builder.config = spin.mergeWithStrategy(strategy, builder.config, overrides[builder.name]);
    }
    builder.config = spin.createConfig(builder, 'webpack', builder.config);
  }

  return { builders, spin };
};

export default createConfig;
