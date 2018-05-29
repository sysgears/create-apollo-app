import creator, { mergePkgJson, ReadFile, RelativePath } from '@jsapp/creator';
import * as fs from 'fs';
import * as path from 'path';
import 'source-map-support/register';

import templates from './templates';

const readFile: ReadFile = filePath =>
  path.basename(filePath.relPath) === 'package.json'
    ? mergePkgJson(filePath, __dirname + '/../templates/presets/')
    : fs.readFileSync(path.join(filePath.rootPath, filePath.relPath), 'utf8');

creator(templates, readFile, 'yarn create apollo-app', process.argv);
