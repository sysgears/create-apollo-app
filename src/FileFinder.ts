import * as fs from 'fs';

export interface FFOptions {
  srcDir: string;
  exclude?: string[];
  nestedLvl?: number;
  stopIfFound?: boolean;
}

export default class {
  private options: FFOptions;

  constructor(options: FFOptions) {
    this.options = options;
  }

  public find = (fileName: string) => {
    const result: string[] = [];

    const filterDirsToProcess = (cwd: string, files: string[]) => {
      return files.filter((file: string) => {
        const condition1 = !file.startsWith('.');
        const condition2 = fs.lstatSync(`${cwd}/${file}`).isDirectory();
        const condition3 = this.options.exclude ? !this.options.exclude.includes(file) : true;
        return condition1 && condition2 && condition3;
      });
    };

    const find1 = (cwd: string, fName: string) => {
      const files = fs.readdirSync(cwd);

      if (files.includes(fName)) {
        result.push(`${cwd}/${fName}`);

        if (this.options.stopIfFound) {
          return;
        }
      }

      filterDirsToProcess(cwd, files).forEach((dir: string) => find1(`${cwd}/${dir}`, fName));
    };

    find1(this.options.srcDir, fileName);

    return result;
  };
}
