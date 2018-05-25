import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../../Builder';
import upDirs from '../../upDirs';

export default class {
  private cwd: string;

  constructor(builder: Builder) {
    this.cwd = builder.require.cwd;
  }

  public find(candidates: string[]): string {
    let foundPath: string;
    const paths = upDirs(this.cwd);
    for (const dir of paths) {
      for (const candidate of candidates) {
        const candidatePath = path.join(dir, candidate);
        if (fs.existsSync(candidatePath)) {
          foundPath = candidatePath;
          break;
        }
      }
      if (foundPath) {
        break;
      }
    }
    return foundPath;
  }
}
