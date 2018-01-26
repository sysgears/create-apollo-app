import * as path from 'path';
import * as requireRelative from 'require-relative';

export interface RequireFunction {
  cwd: string;

  (name, relativeTo?): any;
  builderRelativePath(name): string;
  processRelativePath(name): string;
  resolve(name, relativeTo?): string;
  probe(name, relativeTo?): string;
}

export default (cwd: string, processCwd: string): RequireFunction => {
  const require: any = (name, relativeTo?): any => requireModule(name, relativeTo || cwd);
  require.builderRelativePath = (name): string => requireModule.builderRelativePath(name, processCwd, cwd);
  require.processRelativePath = (name): string => requireModule.processRelativePath(name, processCwd, cwd);
  require.resolve = (name, relativeTo?): string => requireModule.resolve(name, relativeTo || cwd);
  require.probe = (name, relativeTo?): string => requireModule.probe(name, relativeTo || cwd);
  require.cwd = cwd;
  return require;
};

const requireModule: any = (name, relativeTo): any => {
  return name.indexOf('.') !== 0 ? requireRelative(name, relativeTo) : require(path.join(relativeTo, name));
};

requireModule.processRelativePath = (name: string, processCwd: string, cwd: string): string => {
  const relPath = path.relative(processCwd, path.join(cwd, name)).replace(/\\/g, '/');
  return relPath.startsWith('.') ? relPath : './' + relPath;
};

requireModule.builderRelativePath = (name: string, processCwd: string, cwd: string): string => {
  const relPath = path.relative(cwd, path.join(processCwd, name)).replace(/\\/g, '/');
  return relPath.startsWith('.') ? relPath : './' + relPath;
};

requireModule.resolve = (name, relativeTo): string => {
  return name.indexOf('.') !== 0
    ? requireRelative.resolve(name, relativeTo)
    : require.resolve(path.join(relativeTo, name));
};

requireModule.probe = (name, relativeTo): string => {
  try {
    return requireModule.resolve(name, relativeTo);
  } catch (e) {
    return null;
  }
};
