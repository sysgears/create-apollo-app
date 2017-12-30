import { Configuration } from 'webpack';
import * as merge from 'webpack-merge';

import { Builder } from './Builder';
import requireModule from './requireModule';

export interface RequireFunction {
  (name, relativeTo?): any;
  resolve(name, relativeTo?): string;
  probe(name, relativeTo?): string;
}

export default class Spin {
  public dev: boolean;
  public test: boolean;
  public watch: boolean;
  public cmd: string;
  public cwd: string;
  public options: any;
  public require: RequireFunction;

  constructor(cwd, cmd) {
    this.cmd = cmd;
    this.cwd = cwd;
    this.dev = this.cmd === 'watch' || this.cmd === 'test';
    this.test = this.cmd === 'test';
    this.watch = this.cmd === 'watch';
    this.require = (() => {
      const require: any = (name, relativeTo?): any => requireModule(name, relativeTo || cwd);
      require.resolve = (name, relativeTo?): string => requireModule.resolve(name, relativeTo || cwd);
      require.probe = (name, relativeTo?): string => requireModule.probe(name, relativeTo || cwd);
      return require;
    })();
  }

  public merge(config: Configuration, overrides: any): Configuration {
    return merge.smart(config, overrides);
  }

  public mergeWithStrategy(strategy: any, config: Configuration, overrides: any): Configuration {
    return merge.smartStrategy(strategy)(config, overrides);
  }
}
