import { Configuration } from 'webpack';
import * as merge from 'webpack-merge';

import { Builder } from './Builder';
import createRequire, { RequireFunction } from './createRequire';

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
    this.require = createRequire(cwd);
  }

  public merge(config: Configuration, overrides: any): Configuration {
    return merge.smart(config, overrides);
  }

  public mergeWithStrategy(strategy: any, config: Configuration, overrides: any): Configuration {
    return merge.smartStrategy(strategy)(config, overrides);
  }
}
