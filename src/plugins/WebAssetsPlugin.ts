import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class WebAssetsPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return !builder.stack.hasAny('dll') && builder.stack.hasAll('webpack') && builder.stack.hasAny(['server', 'web']);
  }

  public init(builder: any, spin: Spin): InitConfig {
    const stack = builder.stack;

    return {
      dependencies: [],
      devDependencies: []
        .concat(stack.hasAny('web') ? ['url-loader', 'file-loader'] : [])
        .concat(stack.hasAny('server') ? ['ignore-loader'] : [])
    };
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['webpack', 'web']) || (stack.hasAll(['webpack', 'server']) && spin.options.ssr)) {
      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.(png|ico|jpg|xml)$/,
              use: {
                loader: requireModule.resolve('url-loader'),
                options: {
                  name: '[hash].[ext]',
                  limit: 100000
                }
              }
            },
            {
              test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: requireModule.resolve('url-loader'),
                options: {
                  name: './assets/[hash].[ext]',
                  limit: 100000
                }
              }
            },
            {
              test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: requireModule.resolve('file-loader'),
                options: {
                  name: './assets/[hash].[ext]'
                }
              }
            }
          ]
        }
      });
    } else if (stack.hasAll(['webpack', 'server']) && !spin.options.ssr) {
      const ignoreLoader = requireModule.resolve('ignore-loader');
      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.(png|ico|jpg|xml)$/,
              use: {
                loader: ignoreLoader
              }
            },
            {
              test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: ignoreLoader
              }
            },
            {
              test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: ignoreLoader
              }
            }
          ]
        }
      });
    }
  }
}
