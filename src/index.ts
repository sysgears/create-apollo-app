import * as fs from 'fs';
import requireModule from './requireModule';
import execute from './executor';

if (process.argv.length >= 3) {
    const cmd = process.argv[2];
    let config;
    if (cmd === 'watch' || cmd === 'build' || cmd === 'test') {
        let createConfig;
        if (fs.existsSync('spin.config.js')) {
            createConfig = requireModule('./spin.config.js').default;
        } else {
            createConfig = requireModule('spinjs/spin.config.js').default;
        }
        config = createConfig(cmd);
    }
    execute(cmd, config);
}
