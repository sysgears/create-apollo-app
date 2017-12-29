import * as fs from 'fs';
import * as path from 'path';
import { FFResult } from './FileFinder';

const pathsToFix = ['entry', 'backendBuildDir', 'frontendBuildDir', 'dllBuildDir'];

const mergeConfig = (results: FFResult[]) => {
  return results.reduce(
    (merged: any, result: FFResult) => {
      const config = JSON.parse(fs.readFileSync(result.relPath).toString());
      const builders = copyBuilders(config.builders, result);
      const options = copyOptions(config.options, result);

      Object.assign(merged.builders, builders);
      Object.assign(merged.options, options);

      return merged;
    },
    { builders: {}, options: {} }
  );
};

const copyBuilders = (builders: any, result: FFResult) => {
  return Object.keys(builders).reduce((res: any, key: string) => {
    res[key] = builders[key];
    fixPaths(res[key], result);
    return res;
  }, {});
};

const copyOptions = (opts: any, result: FFResult) => {
  const options = opts;
  fixPaths(options, result);
  return options;
};

const fixPaths = (target: any, result: FFResult) => {
  pathsToFix.forEach((key: string) => {
    if (target[key]) {
      target[key] = path.resolve(result.dirRelPath, target[key]).replace(process.cwd(), '.');
    }
  });
};

export default mergeConfig;
