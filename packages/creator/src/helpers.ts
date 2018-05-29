import * as fs from 'fs';
import * as path from 'path';
import { start } from 'repl';

export interface RelativePath {
  rootPath: string;
  relPath: string;
}

export const getRelFilePaths = (rootPath: string, relPath: string = '.'): RelativePath[] => {
  const curPath = path.join(rootPath, relPath);
  const stats = fs.statSync(curPath);
  const result: RelativePath[] = [];

  if (stats.isDirectory()) {
    fs.readdirSync(curPath).forEach(nextPath => {
      result.push.apply(result, getRelFilePaths(rootPath, path.relative(rootPath, path.join(curPath, nextPath))));
    });
  } else if (stats.isFile()) {
    result.push({ rootPath, relPath });
  }

  return result;
};

const sortObject = <T>(obj: T): T =>
  Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {}) as T;

const mergePkgObjs = (dst: any, src: any): any => {
  const result = {};
  for (const key of Object.keys(dst)) {
    if (!!src[key] && typeof dst[key] === 'object') {
      const mergedObj = { ...src[key], ...dst[key] };
      result[key] =
        ['dependencies', 'devDependencies', 'optionalDependencies'].indexOf(key) >= 0
          ? sortObject(mergedObj)
          : mergedObj;
    } else if (!src[key]) {
      result[key] = dst[key];
    }
  }
  for (const key of Object.keys(src)) {
    if (!dst[key]) {
      result[key] = src[key];
    }
  }
  return result;
};

const readPackage = (filePath: RelativePath, presetsRoot: string): any => {
  const json = JSON.parse(fs.readFileSync(path.join(filePath.rootPath, filePath.relPath), 'utf8'));
  const presets = json['!presets'];
  let tmp = {};
  if (presets) {
    presets.forEach(preset => {
      tmp = mergePkgObjs(tmp, readPackage({ rootPath: presetsRoot, relPath: preset + '/package.json' }, presetsRoot));
    });
    delete json['!presets'];
  }
  return mergePkgObjs(json, tmp);
};

export const mergePkgJson = (filePath: RelativePath, presetsRoot: string): string =>
  JSON.stringify(readPackage(filePath, presetsRoot), null, 2);
