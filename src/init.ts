import * as fs from 'fs';
import * as fuzzy from 'fuzzy';
import * as inquirer from 'inquirer';
import * as autocomplete from 'inquirer-autocomplete-prompt';
import * as minilog from 'minilog';
import * as path from 'path';
import ConfigRc from './configRc';
import { Dependencies } from './Dependencies';
import plugins from './plugins';
import Spin from './Spin';
import { StackPlugin } from './StackPlugin';

inquirer.registerPrompt('autocomplete', autocomplete);

const logger = minilog(`init`);

export default () => {
  if (fs.existsSync('package.json')) {
    throw new Error('Unable to continue, package.json exists');
  }

  const values = [
    'react-apollo-server: React Apollo GraphQL Express Server',
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
    } else if (template === 'react-apollo-server') {
      packageJson = {
        ...packageJson,
        spin: {
          builders: {
            web: {
              stack: 'webpack apollo react styled-components sass es6 server',
              openBrowser: true
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
    const allDeps: Dependencies = { deps: [], devDeps: [] };
    for (const name of Object.keys(config.builders)) {
      const builder = config.builders[name];

      for (const plugin of config.plugins) {
        if (plugin.detect(builder, spin) && plugin.init) {
          const pluginDeps = plugin.init(builder, spin);
          allDeps.deps.push.apply(allDeps.deps, pluginDeps.deps);
          allDeps.devDeps.push.apply(allDeps.devDeps, pluginDeps.devDeps);
        }
      }
    }
    logger.info('Deps:', allDeps);
  });
};
