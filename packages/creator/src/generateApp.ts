import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as mustache from 'mustache';
import * as path from 'path';

const writeTemplates = (appName: string, appRoot: string, templateRoot: string, templatePath: string, values: any) => {
  const src = path.join(templateRoot, templatePath);
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs
      .readdirSync(src)
      .forEach(file =>
        writeTemplates(appName, path.join(appRoot, templatePath), path.join(templateRoot, templatePath), file, values)
      );
  } else if (stats.isFile()) {
    const srcTemplate = fs.readFileSync(src, 'utf8');
    const dst = path.join(appName, appRoot, templatePath);
    mkdirp(path.dirname(dst));
    mustache.parse(srcTemplate, ['<%', '%>']);
    fs.writeFileSync(dst, mustache.render(srcTemplate, values));
  }
};

const mkdirp = target =>
  target.split(path.sep).reduce((curPath, dir) => {
    curPath += dir + path.sep;
    if (!fs.existsSync(curPath)) {
      fs.mkdirSync(curPath);
    }
    return curPath;
  }, '');

export default async (appName, template) => {
  mkdirp(appName);

  template.files.forEach(templatePath => {
    writeTemplates(appName, '', path.join(template.filesRoot, templatePath), '', { name: appName });
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
