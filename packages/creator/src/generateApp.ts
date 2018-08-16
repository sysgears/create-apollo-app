import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { camelize } from 'humps';
import * as mustache from 'mustache';
import * as path from 'path';

import { Template, TemplateFilePaths } from './index';

const IS_WINDOWS = /^win/.test(process.platform);

const mkdirp = target =>
  target.split(path.sep).reduce((curPath, dir) => {
    curPath += dir + path.sep;
    if (!fs.existsSync(curPath)) {
      fs.mkdirSync(curPath);
    }
    return curPath;
  }, '');

export type TemplateWriter = (
  files: TemplateFilePaths,
  writeFile: (filePath: string, contents: string) => void,
  vars?: any
) => void;

export type WriteFile = (filePath: string, contents: string, vars?: any) => void;

export default async (appName: string, template: Template, templateWriter: TemplateWriter) => {
  mkdirp(appName);

  const writeFile: WriteFile = (filePath, contents, vars) => {
    const dst = path.join(appName, filePath);
    mkdirp(path.dirname(dst));
    mustache.parse(contents, ['{;', ';}']);
    fs.writeFileSync(
      dst,
      mustache.render(contents, {
        slug: appName,
        camelSlug: camelize(appName),
        name: appName.replace('-', ' ').replace(/\b\w/g, w => w.toUpperCase()),
        ...vars
      })
    );
  };

  templateWriter(template.files, writeFile);

  const yarnCmd = 'yarnpkg' + (IS_WINDOWS ? '.cmd' : '');

  if (template.dependencies) {
    await new Promise(resolve => {
      const yarn = spawn(yarnCmd, ['--cwd', appName, 'add'].concat(template.dependencies), { stdio: 'inherit' });
      yarn.on('close', resolve);
    });
  }

  if (template.devDependencies) {
    await new Promise(resolve => {
      const yarn = spawn(yarnCmd, ['--cwd', appName, 'add', '-D'].concat(template.devDependencies), {
        stdio: 'inherit'
      });
      yarn.on('close', resolve);
    });
  }

  if (!template.dependencies) {
    await new Promise(resolve => {
      const yarn = spawn(yarnCmd, ['--cwd', appName, 'install'], { stdio: 'inherit' });
      yarn.on('close', resolve);
    });
  }

  console.log(`App ${chalk.green(appName)} generated successfully! Execute commands below to start it:\n`);
  console.log(chalk.yellow(`cd ${appName}`));
  console.log(chalk.yellow(`yarn start`));
};
