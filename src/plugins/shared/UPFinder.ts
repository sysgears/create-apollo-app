import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../../Builder';

export default class {
  private dirs: string[];

  constructor(builder: Builder) {
    this.dirs = builder.require.cwd.split(path.sep);
  }

  public find(candidates: string[]): string {
    let foundPath: string;
    const dirs = this.dirs.slice(0);
    while (dirs.length > 0) {
      const curDir = path.join(...dirs);
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
      dirs.pop();
    }
    return foundPath;
  }
}
