import { Configuration } from 'webpack';
import * as merge from 'webpack-merge';
import { Builder } from './Builder';

export default class Spin {
  public dev: boolean;
  public test: boolean;
  public cmd: string;
  public builders: { [x: string]: Builder };
  public options: any;
  public depPlatforms: any;

  constructor(cmd, builders, options, depPlatforms) {
    this.cmd = cmd;
    this.dev = this.cmd === 'watch' || this.cmd === 'test';
    this.test = this.cmd === 'test';
    this.builders = builders;
    this.options = options;
    this.depPlatforms = depPlatforms;
  }

  public merge(config: Configuration, overrides: any): Configuration {
    return merge.smart(config, overrides);
  }

  public mergeWithStrategy(strategy: any, config: Configuration, overrides: any): Configuration {
    return merge.smartStrategy(strategy)(config, overrides);
  }
}
