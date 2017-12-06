import { spawn } from 'child_process';
import * as minilog from 'minilog';
import { join } from 'path';
import { shouldSnapshot } from './utils';

const hasBeenInvoked = false;
const logger = minilog(`before-prepare`);

const escapeWithQuotes = arg => {
  return `"${arg}"`;
};

const spawnChildProcess = (projectDir, command, ...args) => {
  return new Promise((resolve: any, reject: any) => {
    const escapedArgs = args.map(escapeWithQuotes);

    const childProcess = spawn(command, escapedArgs, {
      stdio: 'inherit',
      cwd: projectDir,
      shell: true
    });

    childProcess.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject({
          code,
          message: `child process exited with code ${code}`
        });
      }
    });
  });
};

const throwError = (error: any) => {
  logger.error(error.message);
  process.exit(error.code || 1);
};

const prepareJSWebpack = (config, $mobileHelper, $projectData, originalArgs, originalMethod) => {
  if (config.bundle) {
    return new Promise(function(resolve, reject) {
      logger.info(`Running webpack for ${config.platform}...`);
      const envFlagNames = Object.keys(config.env).concat([config.platform.toLowerCase()]);

      const snapshotEnvIndex = envFlagNames.indexOf('snapshot');
      if (snapshotEnvIndex !== -1 && !shouldSnapshot($mobileHelper, config.platform, config.bundle)) {
        envFlagNames.splice(snapshotEnvIndex, 1);
      }

      const args = [
        $projectData.projectDir,
        'node',
        '--preserve-symlinks',
        join($projectData.projectDir, 'node_modules', 'webpack', 'bin', 'webpack.js'),
        '--config=webpack.config.js',
        '--progress',
        ...envFlagNames.map(item => `--env.${item}`)
      ].filter(a => !!a);

      // TODO: require webpack instead of spawning
      spawnChildProcess
        .call(this, ...args)
        .then(resolve)
        .catch(throwError);
    });
  }
};

export default function($mobileHelper, $projectData, hookArgs) {
  const env = hookArgs.config.env || {};
  const platform = hookArgs.config.platform;
  const appFilesUpdaterOptions = hookArgs.config.appFilesUpdaterOptions;
  const config = {
    env,
    platform,
    bundle: appFilesUpdaterOptions.bundle
  };

  return config.bundle && prepareJSWebpack.bind(prepareJSWebpack, config, $mobileHelper, $projectData);
}
