import * as yargs from 'yargs';

import createConfig from './createConfig';
import execute from './executor';

const handler = args => {
    console.log("args:", args);
};

const argv = yargs
    .command('build', 'compiles package for usage in production')
    .command('watch', 'launches package in development mode with hot code reload',)
    .command('test [mocha-webpack options]', 'runs package tests')
    .demandCommand(1, '')
    .help()
    .version(require('../package.json').version)
    .argv;

const cmd = argv._[0];
let config;
if (cmd === 'watch' || cmd === 'build' || cmd === 'test') {
    config = createConfig(cmd);
}
execute(cmd, config.builders, config.options);
