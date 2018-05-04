import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../../Builder';

export default class {
  private cwd: string;

  constructor(builder: Builder) {
    this.cwd = builder.require.cwd;
  }

  public find(candidates: string[]): string {
    let foundPath: string;
    let curDir = this.cwd;
    while (true) {
      for (const candidate of candidates) {
        const candidatePath = path.join(curDir, candidate);
        if (fs.existsSync(candidatePath)) {
          foundPath = candidatePath;
          break;
        }
      }
      if (foundPath) {
        break;
      }
      curDir = curDir.substring(0, curDir.lastIndexOf(path.sep));
      if (curDir.indexOf(path.sep) < 0) {
        break;
      }
    }
    return foundPath;
  }
}
