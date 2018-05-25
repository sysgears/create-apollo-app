import * as fs from 'fs';
import * as path from 'path';
import createRequire, { RequireFunction } from './createRequire';

interface Dependencies {
  [x: string]: string;
}

const getDeps = (packageJsonPath: string, requireDep: RequireFunction, deps: Dependencies): Dependencies => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const pkgDeps: any = Object.keys(pkg.dependencies || {});
  let result = { ...deps };
  for (const dep of pkgDeps) {
    if (!dep.startsWith('.') && !result[dep]) {
      let depPkg;
      try {
        depPkg = requireDep.resolve(dep + '/package.json');
      } catch (e) {}
      if (depPkg) {
        result[dep] = depPkg;
        const subDeps = getDeps(depPkg, requireDep, result);
        result = { ...result, ...subDeps };
      }
    }
  }
  return result;
};

const entryExts = ['js', 'jsx', 'ts', 'tsx'];
const entryDirs = ['.', 'src'];
let entryCandidates = [];
for (const dir of entryDirs) {
  entryCandidates = entryCandidates.concat(entryExts.map(ext => path.join(dir, 'index.' + ext)));
}

const isJsApp = (pkg: any): boolean => {
  let result = false;
  if (pkg.dependencies) {
    const keys = Object.keys(pkg.dependencies);
    for (const key of keys) {
      if (key.startsWith('@jsapp')) {
        result = true;
      }
    }
  }
  return result;
};

export default (pkg: any, packageJsonPath: string): any => {
  if (!isJsApp(pkg)) {
    return undefined;
  }
  const requireDep = createRequire(path.dirname(packageJsonPath));
  const deps = getDeps(packageJsonPath, requireDep, {});

  const stack = [];
  if (deps['body-parser']) {
    stack.push('server');
  }
  if (deps['babel-core']) {
    stack.push('es6');
  }
  stack.push('js');
  if (deps.typescript) {
    stack.push('ts');
  }
  if (deps['apollo-server-express']) {
    stack.push('apollo');
  }
  if (deps.webpack) {
    stack.push('webpack');
  }

  let entry;
  for (const entryPath of entryCandidates) {
    if (fs.existsSync(entryPath)) {
      entry = entryPath;
      break;
    }
  }
  if (!entry) {
    throw new Error('Cannot find entry file, tried: ' + entryCandidates);
  }

  const builder = {
    entry,
    stack,
    silent: true,
    nodeDebugger: false
  };

  const config = {
    builders: {
      [pkg.name]: builder
    }
  };

  return config;
};
