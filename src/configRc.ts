import * as fs from 'fs';

import requireModule from './requireModule';
import Stack from './stack';
const pkg = requireModule('./package.json');

const SPIN_CONFIG_NAME = '.spinrc';

export default class ConfigRc {
  options: any;
  builders: Object;

  constructor() {
    const config = fs.existsSync(SPIN_CONFIG_NAME) ?
        JSON.parse(fs.readFileSync(SPIN_CONFIG_NAME).toString()) : pkg.spin;
    const builders = {};
    for (let name of Object.keys(config.builders)) {
      const builderVal = config.builders[name];
      const builder: any = typeof builderVal === 'object' ? {...builderVal} : {stack: builderVal};
      builder.name = name;
      builder.stack = new Stack(config.options.stack, typeof builder === 'object' ? builder.stack : builder);
      builder.roles = builder.roles || ['build', 'watch'];
      builders[builder.name] = builder;
    }
    this.builders = builders;
    this.options = {...config.options};
    const options: any = this.options;

    options.backendBuildDir = options.backendBuildDir || 'build/server';
    options.frontendBuildDir = options.frontendBuildDir || 'build/client';
    options.dllBuildDir = options.dllBuildDir || 'build/dll';
    options.webpackDevPort = options.webpackDevPort || 3000;
    options.webpackDll = options.webpackDll !== undefined ? options.webpackDll : true;
  }
}
