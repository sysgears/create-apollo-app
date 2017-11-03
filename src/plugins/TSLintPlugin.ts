import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class TSLintPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAny('tslint');
  }

  public init(builder: Builder, spin: Spin): InitConfig {
    return {
      devDependencies: ['tslint'],
      fs: {
        ['package.json']: {
          scripts: {
            lint: 'tslint --fix -p tsconfig.json --type-check'
          }
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
      }
    };
  }
}
