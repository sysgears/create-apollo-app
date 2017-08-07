import * as fs from 'fs';
import requireModule from './requireModule';

export default cmd => {
    let createConfig;
    if (fs.existsSync('spin.config.js')) {
        createConfig = requireModule('./spin.config.js').default;
    } else {
        createConfig = requireModule('spinjs/spin.config.js').default;
    }
    return createConfig(cmd);
}