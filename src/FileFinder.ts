import * as fs from 'fs';

export interface FFOptions {
  srcDir: string;
  exclude?: string[];
  nestedLvl?: number;
  stopIfFound?: boolean;
}

export interface FFResult {
  absPath: string;
  relPath: string;
  dirAbsPath: string;
  dirRelPath: string;
}

export default class {
  private options: FFOptions;

  constructor(options: FFOptions) {
    this.options = options;
  }

  public find = (fileName: string): FFResult[] => {
    const result: FFResult[] = [];

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
        result.push({
          absPath: `${cwd}/${fName}`,
          relPath: `.${cwd.replace(this.options.srcDir, '')}/${fName}`,
          dirAbsPath: cwd,
          dirRelPath: `.${cwd.replace(this.options.srcDir, '')}`
        });

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
