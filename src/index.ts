import * as minilog from 'minilog';
import * as yargs from 'yargs';

import createConfig from './createConfig';
import execute from './executor';
import init from './init';

minilog.enable();

const argv = yargs
  .command('build', 'compiles package for usage in production')
  .command('watch', 'launches package in development mode with hot code reload')
  .command('exp', 'launches server for exp and exp tool')
  .command('test [mocha-webpack options]', 'runs package tests')
  .demandCommand(1, '')
  .option('c', {
    describe: 'Specify path to config file',
    type: 'string'
  })
  .option('verbose', {
    alias: 'v',
    default: false,
    describe: 'Show generated config',
    type: 'boolean'
  })
    .version(require('../package.json').version) // tslint:disable-line
    .argv;

const cmd = argv._[0];
let config;
if (argv.help && cmd !== 'exp') {
  yargs.showHelp();
} else {
  if (cmd === 'watch' || cmd === 'build' || cmd === 'test' || cmd === 'exp') {
    config = createConfig(cmd, argv);
  }

  if (cmd === 'init') {
    init();
  } else {
    execute(cmd, argv, config.builders, config.options);
  }
}
