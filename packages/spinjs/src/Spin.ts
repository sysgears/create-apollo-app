// tslint:disable-next-line
import { Configuration } from 'webpack';
import * as merge from 'webpack-merge';

import { Builder } from './Builder';

export default class Spin {
  public dev: boolean;
  public test: boolean;
  public watch: boolean;
  public cmd: string;
  public cwd: string;
  public options: any;

  constructor(cwd, cmd) {
    this.cmd = cmd;
    this.cwd = cwd;
    this.dev = ['watch', 'start', 'test'].indexOf(this.cmd) >= 0;
    this.test = this.cmd === 'test';
    this.watch = ['watch', 'start'].indexOf(this.cmd) >= 0;
  }

  public createConfig(builder: Builder, tool: string, config): Configuration {
    const { merge: mergeStrategy, ...configOverrides } = builder[tool + 'Config'] || { merge: {} };
    return this.mergeWithStrategy(mergeStrategy, config, configOverrides);
  }

  public merge(config: any, overrides: any): Configuration {
    return merge.smart(config, overrides);
  }

  public mergeWithStrategy(strategy: any, config: any, overrides: any): Configuration {
    return merge.smartStrategy(strategy)(config, overrides);
  }
}
