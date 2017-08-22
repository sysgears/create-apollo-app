import * as fs from 'fs';

import requireModule from './requireModule';
import Stack from './stack';
const pkg = requireModule('./package.json');

const SPIN_CONFIG_NAME = '.spinrc';

export default class ConfigRc {
  options: any;
  nodes: Object;

  constructor() {
    const config = fs.existsSync(SPIN_CONFIG_NAME) ?
        JSON.parse(fs.readFileSync(SPIN_CONFIG_NAME).toString()) : pkg.spin;
    const nodes = {};
    for (let name of Object.keys(config.nodes)) {
      const nodeVal = config.nodes[name];
      const node: any = typeof nodeVal === 'object' ? {...nodeVal} : {stack: nodeVal};
      node.name = name;
      node.stack = new Stack(config.options.stack, typeof node === 'object' ? node.stack : node);
      node.roles = node.roles || ['build', 'watch'];
      nodes[node.name] = node;
    }
    this.nodes = nodes;
    this.options = {...config.options};
    const options: any = this.options;

    options.backendBuildDir = options.backendBuildDir || 'build/server';
    options.frontendBuildDir = options.frontendBuildDir || 'build/client';
    options.dllBuildDir = options.dllBuildDir || 'build/dll';
    options.webpackDevPort = options.webpackDevPort || 3000;
    options.webpackDll = options.webpackDll !== undefined ? options.webpackDll : true;
  }
}
