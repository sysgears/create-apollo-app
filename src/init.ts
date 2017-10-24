import * as fs from 'fs';
import * as fuzzy from 'fuzzy';
import * as inquirer from 'inquirer';
import * as autocomplete from 'inquirer-autocomplete-prompt';
import * as minilog from 'minilog';
import * as path from 'path';
import * as merge from 'webpack-merge';

import ConfigRc from './configRc';
import { InitConfig } from './InitConfig';
import plugins from './plugins';
import Spin from './Spin';
import { StackPlugin } from './StackPlugin';

inquirer.registerPrompt('autocomplete', autocomplete);

const logger = minilog(`init`);

export default argv => {
  if (fs.existsSync('package.json')) {
    throw new Error('Unable to continue, package.json exists');
  }

  const values = [
    'react-apollo-server-ts: React Apollo GraphQL Express Server',
    'react-apollo-web: React Apollo GraphQL Web frontend'
  ];
  const questions = [
    {
      type: 'autocomplete',
      name: 'template',
      message: 'Choose template',
      source: (answers, input) => {
        input = input || '';
        return new Promise(resolve => {
          const result = fuzzy.filter(input, values);
          resolve(result.map(el => el.original));
        });
      }
    }
  ];

  inquirer.prompt(questions).then(answers => {
    const template = answers.template.split(':')[0];
    let packageJson: any = {
      name: path.basename(process.cwd(), path.extname(process.cwd())),
      version: '1.0.0',
      license: 'MIT',
      spin: {
        builders: {},
        options: {
          backendUrl: 'http://{ip}:8080/graphql',
          ssr: true,
          webpackDll: true
        }
      }
    };
    if (template === 'react-apollo-web') {
      packageJson = {
        ...packageJson,
        spin: {
          builders: {
            web: {
              stack: 'webpack apollo react styled-components sass es6 web',
              openBrowser: true
            }
          }
        }
      };
    } else if (template === 'react-apollo-server-ts') {
      packageJson = {
        ...packageJson,
        spin: {
          builders: {
            server: {
              stack: 'webpack apollo react styled-components sass ts server'
            }
          }
        }
      };
    } else {
      throw new Error(`Don\'t know how to handle template ${template}`);
    }

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    const config = new ConfigRc(plugins);
    const spin = new Spin('init', config.builders, config.options, {});
    let finalConfig: InitConfig = {};
    for (const name of Object.keys(config.builders)) {
      const builder = config.builders[name];

      for (const plugin of config.plugins) {
        if (plugin.detect(builder, spin) && plugin.init) {
          const initConfig = plugin.init(builder, spin);
          finalConfig = merge.smart(finalConfig, initConfig);
        }
      }
    }
    if (argv.verbose) {
      logger.debug('Init Config:', finalConfig);
    }
  });
};
