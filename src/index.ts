import * as minilog from 'minilog';
import * as yargs from 'yargs';

import createConfig from './createConfig';
import execute from './executor';
import init from './init';

minilog.enable();

const argv = yargs
  .command('build', 'compiles package for usage in production')
  .command('watch', 'launches package in development mode with hot code reload')
  .command('test [mocha-webpack options]', 'runs package tests')
  .demandCommand(1, '')
  .option('verbose', {
    alias: 'v',
    default: false,
    describe: 'Show generated config',
    type: 'boolean'
  })
  .help()
    .version(require('../package.json').version) // tslint:disable-line
    .argv;

const cmd = argv._[0];
let config;
if (cmd === 'watch' || cmd === 'build' || cmd === 'test') {
  config = createConfig(cmd);
}

if (cmd === 'init') {
  init(argv);
} else {
  execute(cmd, argv, config.builders, config.options);
}
