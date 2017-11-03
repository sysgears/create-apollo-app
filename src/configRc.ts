import * as fs from 'fs';

import { Builder } from './Builder';
import requireModule from './requireModule';
import Stack from './Stack';
import { StackPlugin } from './StackPlugin';

const SPIN_CONFIG_NAME = '.spinrc.json';

export default class ConfigRc {
  public options: any;
  public builders: { [x: string]: Builder };
  public plugins: StackPlugin[];

  constructor(plugins) {
    const pkg = requireModule('./package.json');

    let config = pkg.spin ? pkg.spin : JSON.parse(fs.readFileSync(SPIN_CONFIG_NAME).toString());

    if (typeof config === 'string' || (typeof config === 'object' && config.constructor === Array)) {
      config = {
        builders: {
          [pkg.name]: config
        }
      };
    }

    if (!config.options) {
      config.options = {};
    }

    const builders: { [x: string]: Builder } = {};
    for (const name of Object.keys(config.builders)) {
      const builderVal = config.builders[name];
      const builder: any =
        typeof builderVal === 'object' && builderVal.constructor !== Array ? { ...builderVal } : { stack: builderVal };
      builder.name = name;
      builder.stack = new Stack(config.options.stack, typeof builder === 'object' ? builder.stack : builder);
      builder.roles = builder.roles || ['build', 'watch'];
      builders[builder.name] = builder;
    }
    this.builders = builders;
    this.options = { ...config.options };
    this.plugins = plugins.concat((config.plugins || []).map(name => new (require(name))()));
    const options: any = this.options;

    options.backendBuildDir = options.backendBuildDir || 'build/server';
    options.frontendBuildDir = options.frontendBuildDir || 'build/client';
    options.dllBuildDir = options.dllBuildDir || 'build/dll';
    options.backendUrl = options.backendUrl || 'http://localhost:8080';
    options.webpackDll = options.webpackDll !== undefined ? options.webpackDll : true;
  }
}
