import * as fs from 'fs';

import { Builder } from './Builder';
import Stack from './Stack';

const SPIN_CONFIG_NAME = '.spinrc.json';

export default class ConfigRc {
  public builders: { [x: string]: Builder };
  public plugins: object[];

  constructor(spin, plugins, argv) {
    const pkg = spin.require('./package.json');
    let config = argv.c
      ? JSON.parse(fs.readFileSync(spin.require.resolve(argv.c)).toString())
      : pkg.spin ? pkg.spin : JSON.parse(fs.readFileSync(spin.require.resolve(SPIN_CONFIG_NAME)).toString());

    if (typeof config === 'string' || (typeof config === 'object' && config.constructor === Array)) {
      config = {
        builders: {
          [pkg.name]: config
        }
      };
    }

    config.options = config.options || {};

    const builders: { [x: string]: Builder } = {};
    const { stack, ...options } = config.options;
    for (const name of Object.keys(config.builders)) {
      const builderVal = config.builders[name];
      const builder: any =
        typeof builderVal === 'object' && builderVal.constructor !== Array ? { ...builderVal } : { stack: builderVal };
      builder.name = name;
      builder.stack = new Stack(config.options.stack || [], typeof builder === 'object' ? builder.stack : builder);
      builder.roles = builder.roles || ['build', 'watch'];
      for (const key of Object.keys(options)) {
        builder[key] = options[key];
      }
      builders[builder.name] = builder;
      // TODO: remove backendBuildDir, frontendBuildDir in 0.5.x
      builder.buildDir = builder.backendBuildDir || builder.frontendBuildDir ? undefined : 'build';
      builder.dllBuildDir = builder.dllBuildDir || 'build/dll';
      builder.webpackDll = builder.webpackDll !== undefined ? builder.webpackDll : true;
    }
    this.builders = builders;
    this.plugins = plugins.concat((config.plugins || []).map(name => new (require(name))()));
  }
}
