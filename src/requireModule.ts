import * as path from 'path';

const requireModule = name => {
    const modulePath = path.join(process.cwd(), name.indexOf('.') !== 0 ? 'node_modules' : '', name);
    return require(modulePath);
};

export default requireModule;