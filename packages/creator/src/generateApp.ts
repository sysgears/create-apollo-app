import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as mustache from 'mustache';
import * as path from 'path';

import { ReadFile, Template } from './index';

const mkdirp = target =>
  target.split(path.sep).reduce((curPath, dir) => {
    curPath += dir + path.sep;
    if (!fs.existsSync(curPath)) {
      fs.mkdirSync(curPath);
    }
    return curPath;
  }, '');

export default async (appName: string, template: Template, readFile: ReadFile) => {
  mkdirp(appName);

  template.files.forEach(filePath => {
    const srcTemplate = readFile(filePath);
    const dst = path.join(appName, filePath.relPath);
    mkdirp(path.dirname(dst));
    mustache.parse(srcTemplate, ['{;', ';}']);
    fs.writeFileSync(dst, mustache.render(srcTemplate, { name: appName }));
  });

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
