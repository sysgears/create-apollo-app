import creator, { mergePkgJson, TemplateFilePaths, TemplateWriter, WriteFile } from '@jsapp/creator';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import 'source-map-support/register';

import templates from './templates';

const writeWsGitignore = (files: TemplateFilePaths, writeFile: WriteFile) => {
  const relPath = '.gitignore';
  const dirRootSet = files[relPath];
  if (dirRootSet && dirRootSet.length > 1 && dirRootSet[0].dstRoot === '.') {
    const lineToBlock = {};
    const blocks = [];
    for (const dirRoots of dirRootSet) {
      const text = fs.readFileSync(path.join(dirRoots.srcRoot, relPath), 'utf8');
      const textLines = text.split(/\r\n|\r|\n/);
      let curBlock;
      for (const line of textLines) {
        if (line === '') {
          curBlock = undefined;
        } else {
          const block = lineToBlock[line];
          if (block) {
            curBlock = block;
          } else if (curBlock) {
            curBlock.push(line);
            lineToBlock[line] = curBlock;
          } else {
            curBlock = [line];
            lineToBlock[line] = curBlock;
            blocks.push(curBlock);
          }
        }
      }
    }
    writeFile(relPath, blocks.map(block => block.join(os.EOL)).join(os.EOL + os.EOL));
  }
};

const sortObject = <T>(obj: T): T =>
  Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {}) as T;

const writeWsPkgJson = (files: TemplateFilePaths, writeFile: WriteFile) => {
  const relPath = 'package.json';
  const dirRootSet = files[relPath];
  if (dirRootSet.length > 1 && dirRootSet[0].dstRoot === '.') {
    const wsPkg = JSON.parse(fs.readFileSync(path.join(dirRootSet[0].srcRoot, relPath), 'utf8'));
    for (const dirRoots of dirRootSet) {
      const pkg = JSON.parse(mergePkgJson(path.join(dirRoots.srcRoot, relPath), __dirname + '/../templates/presets/'));
      pkg.name += '-' + path.basename(dirRoots.srcRoot);
      if (pkg.devDependencies) {
        wsPkg.devDependencies = { ...(wsPkg.devDependencies || {}), ...pkg.devDependencies };
        delete pkg.devDependencies;
      }
      writeFile(path.join(dirRoots.dstRoot, relPath), JSON.stringify(pkg, null, 2));
    }
    if (wsPkg.devDependencies) {
      wsPkg.devDependencies = sortObject(wsPkg.devDependencies);
    }
    writeFile(relPath, JSON.stringify(wsPkg, null, 2));
  } else {
    const pkg = JSON.parse(
      mergePkgJson(path.join(dirRootSet[0].srcRoot, relPath), __dirname + '/../templates/presets/')
    );
    writeFile(relPath, JSON.stringify(pkg, null, 2));
  }
};

const writeTsJson = (relPath: string, files: TemplateFilePaths, writeFile: WriteFile) => {
  const dirRootSet = files[relPath];
  if (dirRootSet && dirRootSet.length > 0) {
    const wsConfig = JSON.parse(fs.readFileSync(path.join(dirRootSet[0].srcRoot, relPath), 'utf8'));
    writeFile(path.join(dirRootSet[0].dstRoot, relPath), JSON.stringify(wsConfig, null, 2));
    for (const dirRoots of dirRootSet.slice(1)) {
      const config = JSON.parse(fs.readFileSync(path.join(dirRoots.srcRoot, relPath), 'utf8'));
      const result = { extends: '../../' + relPath };
      for (const key of Object.keys(config)) {
        if (JSON.stringify(wsConfig[key]) !== JSON.stringify(config[key])) {
          if (wsConfig[key]) {
            for (const option of Object.keys(config[key])) {
              const wsValue = wsConfig[key][option];
              const value = config[key][option];
              if (JSON.stringify(value) !== JSON.stringify(wsValue)) {
                result[key] = result[key] || {};
                result[key][option] = config[key][option];
              }
            }
          } else {
            result[key] = config[key];
          }
        }
      }
      writeFile(path.join(dirRoots.dstRoot, relPath), JSON.stringify(result, null, 2));
    }
  }
};

const templateWriter: TemplateWriter = (files: TemplateFilePaths, writeFile: WriteFile) => {
  const isWorkspace = files['package.json'].length > 1 && files['package.json'][0].dstRoot === '.';
  writeWsGitignore(files, writeFile);
  writeWsPkgJson(files, writeFile);
  writeTsJson('tsconfig.json', files, writeFile);
  writeTsJson('tslint.json', files, writeFile);
  for (const relPath of Object.keys(files)) {
    if (['.gitignore', 'package.json', 'tsconfig.json', 'tslint.json'].indexOf(relPath) < 0) {
      for (const dirRoots of files[relPath]) {
        const contents =
          path.basename(relPath) === 'package.json'
            ? mergePkgJson(path.join(dirRoots.srcRoot, relPath), __dirname + '/../templates/presets/')
            : fs.readFileSync(path.join(dirRoots.srcRoot, relPath), 'utf8');
        writeFile(path.join(dirRoots.dstRoot, relPath), contents, { isWorkspace });
      }
    }
  }
};

creator(templates, templateWriter, 'yarn create apollo-app', process.argv);
