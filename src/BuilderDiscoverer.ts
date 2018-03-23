import * as fs from 'fs';
import * as path from 'path';

import { Builder, Builders } from './Builder';
import { ConfigPlugin } from './ConfigPlugin';
import ConfigReader from './ConfigReader';
import Spin from './Spin';
import Stack from './Stack';

export default class BuilderDiscoverer {
  private configReader: ConfigReader;
  private cwd: string;
  private argv: any;

  constructor(spin: Spin, plugins: ConfigPlugin[], argv: any) {
    this.configReader = new ConfigReader(spin, plugins);
    this.cwd = spin.cwd;
    this.argv = argv;
  }

  public discover(): Builders {
    return this._discoverRecursively(this.cwd);
  }

  private _discoverRecursively(dir: string): Builders {
    let builders: Builders;
    if (this.argv.c) {
      builders = this.configReader.readConfig(path.join(dir, this.argv.c));
    } else {
      const candidates = ['package.json', '.spinrc.json', '.spinrc', '.spinrc.js'];
      for (const fileName of candidates) {
        builders = this.configReader.readConfig(path.join(dir, fileName));
        if (builders) {
          break;
        }
      }
    }

    const files = fs.readdirSync(dir);
    for (const name of files) {
      const dirPath = path.join(dir, name);
      if (name !== 'node_modules' && fs.statSync(dirPath).isDirectory()) {
        builders = { ...builders, ...this._discoverRecursively(dirPath) };
      }
    }

    return builders;
  }
}
