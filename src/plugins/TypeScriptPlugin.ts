import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TypeScriptPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['ts', 'webpack']);
  }

  public init(builder: Builder, spin: Spin): InitConfig {
    return {
      fs: {
        ['package.json']: {
          scripts: {
            lint: 'tslint --fix -p tsconfig.json --type-check'
          }
        },
        ['tsconfig.json']: {
          compilerOptions: {
            target: 'es5',
            module: 'commonjs',
            lib: ['es2016'],
            moduleResolution: 'node',
            sourceMap: true,
            declaration: true,
            noImplicitAny: false,
            rootDir: 'src',
            outDir: 'lib',
            allowSyntheticDefaultImports: true,
            experimentalDecorators: true,
            pretty: true,
            removeComments: true
          },
          include: ['**/*.ts'],
          exclude: ['node_modules', 'dist', 'lib']
        },
        ['tslint.json']: {
          extends: ['tslint:latest'],
          cliOptions: {
            exclude: ['node_modules', 'dist', 'lib']
          },
          rules: {
            prettier: [
              true,
              {
                printWidth: 120,
                singleQuote: true
              }
            ],
            ban: false,
            'class-name': true,
            eofline: true,
            forin: true,
            'interface-name': [true, 'never-prefix'],
            'jsdoc-format': true,
            'label-position': true,
            'member-access': true,
            'member-ordering': [
              true,
              {
                order: [
                  'static-field',
                  'instance-field',
                  'constructor',
                  'public-instance-method',
                  'protected-instance-method',
                  'private-instance-method'
                ]
              }
            ],
            'no-any': false,
            'no-arg': true,
            'no-bitwise': true,
            'no-conditional-assignment': true,
            'no-consecutive-blank-lines': false,
            'no-console': [true, 'log', 'debug', 'info', 'time', 'timeEnd', 'trace'],
            'no-construct': true,
            'no-debugger': true,
            'no-duplicate-variable': true,
            'no-duplicate-imports': false,
            'no-empty': false,
            'no-eval': true,
            'no-inferrable-types': false,
            'no-internal-module': true,
            'no-null-keyword': false,
            'no-require-imports': false,
            'no-shadowed-variable': true,
            'no-submodule-imports': false,
            'no-switch-case-fall-through': true,
            'no-trailing-whitespace': true,
            'no-unused-expression': true,
            'no-var-keyword': true,
            'no-var-requires': true,
            'object-literal-sort-keys': false,
            radix: true,
            'switch-default': true,
            'triple-equals': [true, 'allow-null-check'],
            typedef: [
              false,
              'call-signature',
              'parameter',
              'arrow-parameter',
              'property-declaration',
              'variable-declaration',
              'member-variable-declaration'
            ],
            'variable-name': [true, 'check-format', 'allow-leading-underscore', 'allow-pascal-case', 'ban-keywords']
          }
        }
      },
      dependencies: [],
      devDependencies: [
        '@types/node',
        '@types/webpack-env',
        'tslint',
        'typescript',
        'awesome-typescript-loader',
        'html-loader'
      ]
    };
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    const jsRuleFinder = new JSRuleFinder(builder);
    const jsRule = jsRuleFinder.rule;
    const { CheckerPlugin } = requireModule('awesome-typescript-loader');
    jsRule.test = /\.ts$/;
    jsRule.use = [
      {
        loader: requireModule.resolve('awesome-typescript-loader'),
        options: { ...builder.tsLoaderOptions }
      }
    ];

    builder.config = spin.merge(builder.config, {
      module: {
        rules: [
          {
            test: /\.html$/,
            loader: requireModule.resolve('html-loader')
          }
        ]
      },
      plugins: [new CheckerPlugin()]
    });

    builder.config.resolve.extensions = ['.']
      .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
      .reduce((acc, val) => acc.concat(val));

    if (!stack.hasAny('dll')) {
      for (const key of Object.keys(builder.config.entry)) {
        const entry = builder.config.entry[key];
        for (let idx = 0; idx < entry.length; idx++) {
          const item = entry[idx];
          if (
            item.startsWith('./') &&
            ['.js', '.jsx', '.ts', '.tsx'].indexOf(path.extname(item)) >= 0 &&
            item.indexOf('node_modules') < 0
          ) {
            const tsItem = './' + path.join(path.dirname(item), path.basename(item, path.extname(item))) + '.ts';
            if (!fs.existsSync(item) && fs.existsSync(tsItem)) {
              entry[idx] = tsItem;
            }
          }
        }
      }
    }
  }
}
