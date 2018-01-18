import * as fs from 'fs';

import { Builder, Builders } from './Builder';
import { ConfigPlugin } from './ConfigPlugin';
import ConfigReader from './ConfigReader';
import Spin from './Spin';
import Stack from './Stack';

export default class BuilderDiscoverer {
  private configReader: ConfigReader;
  private argv: any;

  constructor(spin: Spin, plugins: ConfigPlugin[], argv: any) {
    this.configReader = new ConfigReader(spin, plugins);
    this.argv = argv;
  }

  public discover(): Builders {
    if (this.argv.c) {
      return this.configReader.readConfig(this.argv.c);
    } else {
      const candidates = ['package.json', '.spinrc.json', '.spinrc', '.spinrc.js'];
      for (const fileName of candidates) {
        const builders = this.configReader.readConfig(fileName);
        if (builders) {
          return builders;
        }
      }
    }
    return undefined;
  }
}
