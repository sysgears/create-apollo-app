import * as fs from 'fs';
import * as path from 'path';

import * as projectFilesManager from './plugins/native-script/projectFilesManager';
import { getPackageJson, getProjectDir } from './plugins/native-script/projectHelpers';
// import * as npmScriptsManager './npmScriptsManager';
// import * as dependencyManager './dependencyManager';

const PROJECT_DIR = getProjectDir({ nestingLvl: 3 });
const APP_DIR = path.resolve(PROJECT_DIR, 'src');

const install = () => {
  const packageJson = getPackageJson(PROJECT_DIR);

  projectFilesManager.addProjectFiles(PROJECT_DIR, APP_DIR);

  // const scripts = packageJson.scripts || {};
  // npmScriptsManager.removeDeprecatedNpmScripts(scripts);
  // npmScriptsManager.addNpmScripts(scripts);
  // packageJson.scripts = scripts;
  //
  // const postinstallOptions = dependencyManager.addProjectDeps(packageJson);
  // packageJson.devDependencies = postinstallOptions.deps;
  //
  // helpers.writePackageJson(packageJson, PROJECT_DIR);
  //
  // dependencyManager.showHelperMessages(postinstallOptions);
};

function uninstall() {
  // const packageJson = helpers.getPackageJson(PROJECT_DIR);
  //
  // projectFilesManager.removeProjectFiles(PROJECT_DIR, APP_DIR);
  //
  // const scripts = packageJson.scripts;
  // if (scripts) {
  //     console.log("Removing npm scripts...");
  //     npmScriptsManager.removeDeprecatedNpmScripts(scripts);
  //     npmScriptsManager.removeNpmScripts(scripts);
  // }
  //
  // helpers.writePackageJson(packageJson, PROJECT_DIR);
  //
  // console.log("NativeScript Webpack removed!");
}

export { install, uninstall };
