import * as fs from 'fs';
import * as path from 'path';
import * as merge from 'webpack-merge';

import { Builder, Builders } from './Builder';
import { ConfigPlugin } from './ConfigPlugin';
import EnhancedError from './EnhancedError';
import Spin from './Spin';
import Stack from './Stack';

export default class ConfigReader {
  private spin: Spin;
  private plugins: ConfigPlugin[];

  constructor(spin: Spin, plugins: ConfigPlugin[]) {
    this.spin = spin;
    this.plugins = plugins;
  }

  public readConfig(filePath: string): Builders {
    let configObject: any;
    if (fs.existsSync(filePath)) {
      const extname = path.extname(filePath);
      if (['.json', ''].indexOf(extname) >= 0) {
        try {
          configObject = JSON.parse(fs.readFileSync(filePath).toString());
          if (path.basename(filePath) === 'package.json') {
            configObject = configObject.spin;
          }
        } catch (e) {
          throw new EnhancedError(`Error parsing ${path.resolve(filePath)}`, e);
        }
      } else {
        const exports = this.spin.require(filePath);
        configObject = exports instanceof Function ? exports(this.spin) : exports;
      }
    }
    return typeof configObject === 'undefined' ? undefined : this._createBuilders(filePath, configObject);
  }

  private _createBuilders(filePath: string, config: any): Builders {
    if (typeof config === 'string' || (typeof config === 'object' && config.constructor === Array)) {
      config = {
        builders: {
          app: config
        }
      };
    }

    config.options = config.options || {};

    const relativePath = path.relative(path.dirname(filePath), this.spin.cwd);
    const builders: Builders = {};
    const { stack, plugins, ...options } = config.options;
    for (const name of Object.keys(config.builders)) {
      const builderVal = config.builders[name];
      const builder: any =
        typeof builderVal === 'object' && builderVal.constructor !== Array ? { ...builderVal } : { stack: builderVal };
      builder.name = name;
      builder.stack = new Stack(config.options.stack || [], typeof builder === 'object' ? builder.stack : builder);
      builder.plugins = (config.plugins || []).concat(builder.plugins || []);
      builder.roles = builder.roles || ['build', 'watch'];
      const merged = merge(options, builder);
      for (const key of Object.keys(merged)) {
        builder[key] = merged[key];
      }
      const builderId = `${relativePath}[${builder.name}]`;
      builders[builderId] = builder;
      // TODO: remove backendBuildDir, frontendBuildDir in 0.5.x
      builder.buildDir = builder.backendBuildDir || builder.frontendBuildDir ? undefined : builder.buildDir || 'build';
      builder.dllBuildDir = builder.dllBuildDir || 'build/dll';
      builder.webpackDll = builder.webpackDll !== undefined ? builder.webpackDll : true;
      builder.plugins = this.plugins.concat((builder.plugins || []).map(pluginName => new (require(pluginName))()));
    }
    return builders;
  }
}
