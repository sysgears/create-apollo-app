import * as fs from 'fs';
import * as minilog from 'minilog';
import * as path from 'path';

import { isAngular, isTypeScript } from './projectHelpers';

const logger = minilog(`project-file-manager`);

const FRAME_MATCH = /(\s*)(require\("ui\/frame"\);)(\s*)(require\("ui\/frame\/activity"\);)/g;
const SCOPED_FRAME = `if (!global["__snapshot"]) {
    // In case snapshot generation is enabled these modules will get into the bundle
    // but will not be required/evaluated.
    // The snapshot webpack plugin will add them to the tns-java-classes.js bundle file.
    // This way, they will be evaluated on app start as early as possible.
$1    $2$3    $4
}`;

const CONFIG_MATCH = /(exports = [^]+?)\s*return ({[^]+target:\s*nativescriptTarget[^]+?};)/;
const CONFIG_REPLACE = `$1

    const config = $2

    if (env.snapshot) {
        plugins.push(new nsWebpack.NativeScriptSnapshotPlugin({
            chunk: "vendor",
            projectRoot: __dirname,
            webpackConfig: config,
            targetArchs: ["arm", "arm64", "ia32"],
            tnsJavaClassesOptions: { packages: ["tns-core-modules" ] },
            useLibs: false
        }));
    }

    return config;`;

const addProjectFiles = (projectDir: string, appDir: string) => {
  const projectTemplates = getProjectTemplates(projectDir);
  Object.keys(projectTemplates).forEach((templateName: string) => {
    const templateDestination = projectTemplates[templateName];
    templateName = path.resolve(templateName);
    copyTemplate(templateName, templateDestination);
  });

  const appTemplates = getAppTemplates(projectDir, appDir);
  Object.keys(appTemplates).forEach((templateName: string) => {
    const templateDestination = appTemplates[templateName];
    copyTemplate(templateName, templateDestination);
  });
};

const removeProjectFiles = (projectDir: string, appDir: string) => {
  const projectTemplates = getProjectTemplates(projectDir);
  logger.info(projectTemplates);
  Object.keys(projectTemplates).forEach((templateName: string) => {
    const templateDestination = projectTemplates[templateName];
    deleteFile(templateDestination);
  });

  const appTemplates = getAppTemplates(projectDir, appDir);
  Object.keys(appTemplates).forEach((templateName: string) => {
    const templateDestination = appTemplates[templateName];
    deleteFile(templateDestination);
  });
};

const forceUpdateProjectFiles = (projectDir: string, appDir: string) => {
  removeProjectFiles(projectDir, appDir);
  addProjectFiles(projectDir, appDir);
};

const deleteFile = (destinationPath: string) => {
  if (fs.existsSync(destinationPath)) {
    logger.info(`Deleting file: ${destinationPath}`);
    fs.unlinkSync(destinationPath);
  }
};

const copyTemplate = (templateName: string, destinationPath: string) => {
  // Create destination file, only if not present.
  if (!fs.existsSync(destinationPath)) {
    logger.info(`Creating file: ${destinationPath}`);
    const content = fs.readFileSync(templateName, 'utf8');
    fs.writeFileSync(destinationPath, content);
  }
};

const getProjectTemplates = (projectDir: string) => {
  const templates = {};

  if (isAngular({ projectDir })) {
    templates['webpack.angular.js'] = 'webpack.config.js';
    templates['tsconfig.aot.json'] = 'tsconfig.aot.json';
  } else if (isTypeScript({ projectDir })) {
    templates['webpack.typescript.js'] = 'webpack.config.js';
  } else {
    templates['webpack.javascript.js'] = 'webpack.config.js';
  }

  return getFullTemplatesPath(projectDir, templates);
};

const getAppTemplates = (projectDir: string, appDir: string) => {
  const templates = {
    'vendor-platform.android.ts': tsOrJs(projectDir, 'vendor-platform.android'),
    'vendor-platform.ios.ts': tsOrJs(projectDir, 'vendor-platform.ios')
  };

  if (isAngular({ projectDir })) {
    templates['vendor.angular.ts'] = tsOrJs(projectDir, 'vendor');
  } else {
    templates['vendor.nativescript.ts'] = tsOrJs(projectDir, 'vendor');
  }

  return getFullTemplatesPath(appDir, templates);
};

const getFullTemplatesPath = (projectDir: string, templates: any) => {
  const updatedTemplates = {};

  Object.keys(templates).forEach(key => {
    const updatedKey = getFullPath(path.join(projectDir, 'plugins/native-script/templates'), key);
    const updatedValue = getFullPath(projectDir, templates[key]);

    updatedTemplates[updatedKey] = updatedValue;
  });

  return updatedTemplates;
};

const editExistingProjectFiles = (projectDir: string) => {
  const webpackConfigPath = getFullPath(projectDir, 'webpack.config.js');
  const webpackCommonPath = getFullPath(projectDir, 'webpack.common.js');

  const configChangeFunctions = [replaceStyleUrlResolvePlugin, addSnapshotPlugin];

  editFileContent(webpackConfigPath, ...configChangeFunctions);
  editFileContent(webpackCommonPath, ...configChangeFunctions);

  const extension = isAngular({ projectDir }) ? 'ts' : 'js';
  const vendorAndroidPath = getFullPath(projectDir, `app/vendor-platform.android.${extension}`);

  editFileContent(vendorAndroidPath, addSnapshotToVendor);
};

const editFileContent = (pathToFile: string, ...funcs) => {
  if (!fs.existsSync(pathToFile)) {
    return;
  }

  let content = fs.readFileSync(pathToFile, 'utf8');
  funcs.forEach(fn => (content = fn(content)));

  fs.writeFileSync(pathToFile, content, 'utf8');
};

const replaceStyleUrlResolvePlugin = (config: any) => {
  if (config.indexOf('StyleUrlResolvePlugin') === -1) {
    return config;
  }

  logger.info('Replacing deprecated StyleUrlsResolvePlugin with UrlResolvePlugin...');
  return config.replace(/StyleUrlResolvePlugin/g, 'UrlResolvePlugin');
};

const addSnapshotPlugin = (config: any) => {
  if (config.indexOf('NativeScriptSnapshotPlugin') > -1) {
    return config;
  }

  logger.info('Adding NativeScriptSnapshotPlugin configuration...');
  return config.replace(CONFIG_MATCH, CONFIG_REPLACE);
};

const addSnapshotToVendor = (content: any) => {
  if (content.indexOf('__snapshot') > -1) {
    return content;
  }

  logger.info('Adding __snapshot configuration to app/vendor-platform.android ...');
  return content.replace(FRAME_MATCH, SCOPED_FRAME);
};

const getFullPath = (projectDir: string, filePath: string) => {
  return path.resolve(projectDir, filePath);
};

const tsOrJs = (projectDir: string, name: string) => {
  const extension = isTypeScript({ projectDir }) ? 'ts' : 'js';
  return `${name}.${extension}`;
};

export { addProjectFiles, removeProjectFiles, forceUpdateProjectFiles, editExistingProjectFiles };
