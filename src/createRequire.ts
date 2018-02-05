import * as path from 'path';
import * as requireRelative from 'require-relative';

export interface RequireFunction {
  cwd: string;

  (name, relativeTo?): any;
  resolve(name, relativeTo?): string;
  probe(name, relativeTo?): string;
}

export default (cwd: string): RequireFunction => {
  const require: any = (name, relativeTo?): any => requireModule(name, relativeTo || cwd);
  require.resolve = (name, relativeTo?): string => requireModule.resolve(name, relativeTo || cwd);
  require.probe = (name, relativeTo?): string => requireModule.probe(name, relativeTo || cwd);
  require.cwd = cwd;
  return require;
};

const requireModule: any = (name, relativeTo): any => {
  return name.indexOf('.') !== 0 ? requireRelative(name, relativeTo) : require(path.join(relativeTo, name));
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
