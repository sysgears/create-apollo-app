import creator, { mergePkgJson, ReadFile, TemplatePath, TemplateWriter } from '@jsapp/creator';
import * as fs from 'fs';
import * as path from 'path';
import 'source-map-support/register';

import templates from './templates';

const templateWriter: TemplateWriter = (
  files: TemplatePath[],
  writeFile: (templatePath: TemplatePath, contents: string) => void
) => {
  // files.forEach(filePath => {
  //   console.log(filePath);
  // });
  files.forEach(filePath => {
    const contents =
      path.basename(filePath.relPath) === 'package.json'
        ? mergePkgJson(filePath, __dirname + '/../templates/presets/')
        : fs.readFileSync(path.join(filePath.srcRoot, filePath.relPath), 'utf8');
    writeFile(filePath, contents);
  });
};

creator(templates, templateWriter, 'yarn create apollo-app', process.argv);
