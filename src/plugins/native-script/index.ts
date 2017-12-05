import { existsSync } from 'fs';
import path from 'path';
import { getPackageJson, getProjectDir, resolveAndroidAppPath } from './projectHelpers';

export * from './plugins';
export * from './plugins/angular';

const PROJECT_DIR = getProjectDir({ nestingLvl: 2 });
const APP_DIR = path.join(PROJECT_DIR, 'src');

const uglifyMangleExcludes = './mangle-excludes';

const getEntryModule = () => {
  const maybePackageJsonEntry = getPackageJsonEntry();
  if (!maybePackageJsonEntry) {
    throw new Error('app/package.json must contain a `main` attribute.');
  }

  const maybeAotEntry = getAotEntry(maybePackageJsonEntry);
  return maybeAotEntry || maybePackageJsonEntry;
};

const getAppPath = (platform: any) => {
  if (/ios/i.test(platform)) {
    const appName = path.basename(PROJECT_DIR);
    const sanitizedName = sanitize(appName);

    return `platforms/ios/${sanitizedName}/app`;
  } else if (/android/i.test(platform)) {
    return resolveAndroidAppPath(PROJECT_DIR);
  } else {
    throw new Error(`Invalid platform: ${platform}`);
  }
};

export { uglifyMangleExcludes, getEntryModule, getAppPath };

const sanitize = name =>
  name
    .split('')
    .filter(char => /[a-zA-Z0-9]/.test(char))
    .join('');

function getPackageJsonEntry() {
  const packageJsonSource = getPackageJson(APP_DIR);
  const entry = packageJsonSource.main;

  return entry ? entry.replace(/\.js$/i, '') : null;
}

function getAotEntry(entry) {
  const aotEntry = `${entry}.aot.ts`;
  const aotEntryPath = path.join(APP_DIR, aotEntry);

  return existsSync(aotEntryPath) ? aotEntry : null;
}
