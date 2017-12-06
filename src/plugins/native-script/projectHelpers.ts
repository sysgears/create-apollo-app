import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

const isTypeScript = ({ projectDir, packageJson }: any = {}) => {
  packageJson = packageJson || getPackageJson(projectDir);

  return (
    (packageJson.dependencies && packageJson.dependencies.hasOwnProperty('typescript')) ||
    (packageJson.devDependencies && packageJson.devDependencies.hasOwnProperty('typescript')) ||
    isAngular({ packageJson } as any)
  );
};

const isAngular = ({ projectDir, packageJson }: any = {}) => {
  packageJson = packageJson || getPackageJson(projectDir);

  return (
    packageJson.dependencies && Object.keys(packageJson.dependencies).some(dependency => /^@angular\b/.test(dependency))
  );
};

const getAndroidRuntimeVersion = projectDir => {
  try {
    const projectPackageJSON = getPackageJson(projectDir);

    const version = projectPackageJSON.nativescript['tns-android'].version;
    return version && toReleaseVersion(version);
  } catch (e) {
    return null;
  }
};

const getPackageJson = projectDir => {
  const packageJsonPath = getPackageJsonPath(projectDir);
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

const writePackageJson = (content, projectDir) => {
  const packageJsonPath = getPackageJsonPath(projectDir);
  fs.writeFileSync(packageJsonPath, JSON.stringify(content, null, 2));
};

const getProjectDir = ({ nestingLvl } = { nestingLvl: 0 }) => {
  // INIT_CWD is available since npm 5.4
  const initCwd = process.env.INIT_CWD;
  const shouldUseInitCwd = (() => {
    if (!initCwd) {
      return false;
    }

    const installedPackage = path.resolve(initCwd, 'node_modules', 'spinjs');
    if (!fs.existsSync(installedPackage)) {
      return false;
    }

    const stat = fs.lstatSync(installedPackage);
    return stat.isSymbolicLink();
  })();

  return shouldUseInitCwd ? initCwd : Array.from(Array(nestingLvl)).reduce(dir => path.dirname(dir), __dirname);
};

const toReleaseVersion = version => version.replace(/-.*/, '');

const getAndroidProjectPath = ({ androidPackageVersion, projectRoot }) => {
  const ANDROID_PROJECT_PATH = 'platforms/android';
  if (projectRoot) {
    androidPackageVersion = getAndroidRuntimeVersion(projectRoot);
  }

  return semver.lt(androidPackageVersion, '3.4.0') ? ANDROID_PROJECT_PATH : path.join(ANDROID_PROJECT_PATH, 'app');
};

const resolveAndroidAppPath = projectDir => {
  const RESOURCES_PATH = 'src/main/assets/app';
  const androidPackageVersion = getAndroidRuntimeVersion(projectDir);
  const androidProjectPath = getAndroidProjectPath({ androidPackageVersion } as any);

  return path.join(projectDir, androidProjectPath, RESOURCES_PATH);
};

const resolveAndroidConfigurationsPath = projectDir => {
  const CONFIGURATIONS_DIR = 'configurations';
  const androidPackageVersion = getAndroidRuntimeVersion(projectDir);
  const androidProjectPath = getAndroidProjectPath({ androidPackageVersion } as any);

  const configurationsPath = semver.lt(androidPackageVersion, '3.3.0')
    ? path.join(androidProjectPath, CONFIGURATIONS_DIR)
    : path.join(androidProjectPath, 'build', CONFIGURATIONS_DIR);

  return path.join(projectDir, configurationsPath);
};

const getPackageJsonPath = projectDir => path.resolve(projectDir, 'package.json');

export {
  isTypeScript,
  isAngular,
  writePackageJson,
  getPackageJson,
  getProjectDir,
  getAndroidRuntimeVersion,
  getAndroidProjectPath,
  resolveAndroidAppPath,
  resolveAndroidConfigurationsPath
};
