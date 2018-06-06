import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { camelize } from 'humps';
import * as mustache from 'mustache';
import * as path from 'path';

import { ReadFile, Template, TemplatePath } from './index';

const mkdirp = target =>
  target.split(path.sep).reduce((curPath, dir) => {
    curPath += dir + path.sep;
    if (!fs.existsSync(curPath)) {
      fs.mkdirSync(curPath);
    }
    return curPath;
  }, '');

export type TemplateWriter = (
  files: TemplatePath[],
  writeFile: (relPath: TemplatePath, contents: string) => void
) => void;

export default async (appName: string, template: Template, templateWriter: TemplateWriter) => {
  mkdirp(appName);

  const writeFile = (filePath: TemplatePath, contents: string) => {
    const dst = path.join(appName, filePath.dstRoot, filePath.relPath);
    mkdirp(path.dirname(dst));
    mustache.parse(contents, ['{;', ';}']);
    fs.writeFileSync(
      dst,
      mustache.render(contents, {
        slug: appName,
        camelSlug: camelize(appName),
        name: appName.replace('-', ' ').replace(/\b\w/g, w => w.toUpperCase())
      })
    );
  };

  templateWriter(template.files, writeFile);

  if (template.dependencies) {
    await new Promise(resolve => {
      const yarn = spawn('yarnpkg', ['--cwd', appName, 'add'].concat(template.dependencies), { stdio: 'inherit' });
      yarn.on('close', resolve);
    });
  }

  if (template.devDependencies) {
    await new Promise(resolve => {
      const yarn = spawn('yarnpkg', ['--cwd', appName, 'add', '-D'].concat(template.devDependencies), {
        stdio: 'inherit'
      });
      yarn.on('close', resolve);
    });
  }

  if (!template.dependencies) {
    await new Promise(resolve => {
      const yarn = spawn('yarnpkg', ['--cwd', appName, 'install']);
      yarn.on('close', resolve);
    });
  }

  console.log(`App ${chalk.green(appName)} generated successfully! Execute commands below to start it:\n`);
  console.log(chalk.yellow(`cd ${appName}`));
  console.log(chalk.yellow(`yarn start`));
};
