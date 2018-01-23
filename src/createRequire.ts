import * as path from 'path';
import * as requireRelative from 'require-relative';

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

export default requireModule;
