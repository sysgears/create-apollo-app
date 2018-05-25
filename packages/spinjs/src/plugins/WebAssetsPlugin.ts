import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

export default class WebAssetsPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (
      !stack.hasAny('dll') &&
      (stack.hasAll(['webpack', 'web']) || (stack.hasAll(['webpack', 'server']) && builder.ssr))
    ) {
      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.(png|ico|jpg|gif|xml)$/,
              use: {
                loader: 'url-loader',
                options: spin.createConfig(builder, 'url', {
                  name: '[hash].[ext]',
                  limit: 100000
                })
              }
            },
            {
              test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: 'url-loader',
                options: spin.createConfig(builder, 'url', {
                  name: '[hash].[ext]',
                  limit: 100000
                })
              }
            },
            {
              test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: 'file-loader',
                options: spin.createConfig(builder, 'file', {
                  name: '[hash].[ext]'
                })
              }
            }
          ]
        }
      });
    } else if (!stack.hasAny('dll') && stack.hasAll(['webpack', 'server']) && !builder.ssr) {
      const ignoreLoader = 'ignore-loader';
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
