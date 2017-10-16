import * as path from 'path';

const requireModule: any = name => {
  const modulePath = path.join(process.cwd(), name.indexOf('.') !== 0 ? 'node_modules' : '', name);
  return require(modulePath);
};

requireModule.resolve = name => {
  const modulePath = path.join(process.cwd(), name.indexOf('.') !== 0 ? 'node_modules' : '', name);
  return require.resolve(modulePath);
};

export default requireModule;
