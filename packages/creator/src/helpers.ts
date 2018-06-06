import * as fs from 'fs';
import * as path from 'path';
import { start } from 'repl';

export interface TemplatePath {
  srcRoot: string;
  dstRoot: string;
  relPath: string;
}

export const getTemplateFilePaths = (options: TemplatePath | TemplatePath[] | string): TemplatePath[] => {
  const result: TemplatePath[] = [];

  [].concat(options).forEach(curOpts => {
    curOpts = typeof curOpts === 'string' ? { srcRoot: curOpts, dstRoot: '.', relPath: '.' } : curOpts;
    const curPath = path.join(curOpts.srcRoot, curOpts.relPath);
    const stats = fs.statSync(curPath);

    if (stats.isDirectory()) {
      fs.readdirSync(curPath).forEach(nextPath => {
        result.push.apply(
          result,
          getTemplateFilePaths({
            srcRoot: curOpts.srcRoot,
            dstRoot: curOpts.dstRoot,
            relPath: path.relative(curOpts.srcRoot, path.join(curPath, nextPath))
          })
        );
      });
    } else if (stats.isFile()) {
      result.push({ srcRoot: curOpts.srcRoot, relPath: curOpts.relPath, dstRoot: curOpts.dstRoot });
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

const readPackage = (pkgTemplatePath: TemplatePath, presetsRoot: string): any => {
  const json = JSON.parse(fs.readFileSync(path.join(pkgTemplatePath.srcRoot, pkgTemplatePath.relPath), 'utf8'));
  const presets = json['!presets'];
  let tmp = {};
  if (presets) {
    presets.forEach(preset => {
      tmp = mergePkgObjs(
        tmp,
        readPackage(
          { srcRoot: presetsRoot, dstRoot: pkgTemplatePath.dstRoot, relPath: preset + '/package.json' },
          presetsRoot
        )
      );
    });
    delete json['!presets'];
  }
  return mergePkgObjs(json, tmp);
};

export const mergePkgJson = (filePath: TemplatePath, presetsRoot: string): string =>
  JSON.stringify(readPackage(filePath, presetsRoot), null, 2);
