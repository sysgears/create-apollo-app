import * as fs from 'fs';
import * as path from 'path';
import { start } from 'repl';

export interface DirRoots {
  srcRoot: string;
  dstRoot: string;
}

export interface TemplateFilePaths {
  [relativePath: string]: DirRoots[];
}

export const getTemplateFilePaths = (options: DirRoots[] | string, startFile: string = '.'): TemplateFilePaths => {
  const result: TemplateFilePaths = {};

  [].concat(options).forEach(dirRoots => {
    dirRoots = typeof dirRoots === 'string' ? { srcRoot: dirRoots, dstRoot: '.' } : dirRoots;
    const absPath = path.join(dirRoots.srcRoot, startFile);
    const stats = fs.statSync(absPath);

    if (stats.isDirectory()) {
      fs.readdirSync(absPath).forEach(relPath => {
        const templatePaths = getTemplateFilePaths(dirRoots, path.join(startFile, relPath));
        for (const filePath of Object.keys(templatePaths)) {
          result[filePath] = !result[filePath]
            ? templatePaths[filePath]
            : result[filePath].concat(templatePaths[filePath]);
        }
      });
    } else if (stats.isFile()) {
      if (!result[startFile]) {
        result[startFile] = [];
      }
      result[startFile].push(dirRoots);
    }
  });

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

const readPackage = (pkgTemplatePath: string, presetsRoot: string): any => {
  const json = JSON.parse(fs.readFileSync(pkgTemplatePath, 'utf8'));
  const presets = json['!presets'];
  let tmp = {};
  if (presets) {
    presets.forEach(preset => {
      tmp = mergePkgObjs(tmp, readPackage(path.join(presetsRoot, preset, 'package.json'), presetsRoot));
    });
    delete json['!presets'];
  }
  return mergePkgObjs(json, tmp);
};

export const mergePkgJson = (pkgTemplatePath: string, presetsRoot: string): string =>
  JSON.stringify(readPackage(pkgTemplatePath, presetsRoot), null, 2);
