import * as path from 'path';
import * as requireRelative from 'require-relative';

const requireModule: any = (name, relativeTo) => {
  return name.indexOf('.') !== 0
    ? requireRelative(name, relativeTo)
    : require(path.join(relativeTo || process.cwd(), name));
};

requireModule.resolve = (name, relativeTo) => {
  return name.indexOf('.') !== 0
    ? requireRelative.resolve(name, relativeTo)
    : require.resolve(path.join(relativeTo || process.cwd(), name));
};

requireModule.probe = (name, relativeTo) => {
  try {
    return requireModule.resolve(name, relativeTo);
  } catch (e) {
    return false;
  }
};

export default requireModule;
