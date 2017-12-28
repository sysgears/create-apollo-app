import * as fs from 'fs';

import { Builder } from './Builder';
import FileFinder from './FileFinder';
import requireModule from './requireModule';
import Stack from './Stack';

const pkg = requireModule('./package.json');

const SPIN_CONFIG_NAME = '.spinrc.json';

export default class ConfigRc {
  public options: any;
  public builders: { [x: string]: Builder };
  public plugins: object[];

  constructor(plugins, argv) {
    const finder = new FileFinder({
      srcDir: process.cwd(),
      exclude: ['node_modules', 'flow-typed', 'build'],
      stopIfFound: true
    });
    // console.log(finder.find('.spinrc.json'));

    let config = argv.c
      ? JSON.parse(fs.readFileSync(argv.c).toString())
      : pkg.spin ? pkg.spin : JSON.parse(fs.readFileSync(SPIN_CONFIG_NAME).toString());

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
      builder.backendUrl = builder.backendUrl || config.options.backendUrl || 'http://localhost:8080';
      builders[builder.name] = builder;
    }
    this.builders = builders;
    this.options = { ...config.options };
    this.plugins = plugins.concat((config.plugins || []).map(name => new (require(name))()));
    const options: any = this.options;

    options.backendBuildDir = options.backendBuildDir || 'build/server';
    options.frontendBuildDir = options.frontendBuildDir || 'build/client';
    options.dllBuildDir = options.dllBuildDir || 'build/dll';
    options.webpackDll = options.webpackDll !== undefined ? options.webpackDll : true;
  }
}
