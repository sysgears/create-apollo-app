import * as path from 'path';

import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

let babelRegisterDone = false;

const registerBabel = () => {
  if (!babelRegisterDone) {
    requireModule('babel-register')({
      presets: [requireModule.resolve('babel-preset-es2015'), requireModule.resolve('babel-preset-flow')],
      ignore: /node_modules(?!\/(haul|react-native))/,
      retainLines: true,
      sourceMaps: 'inline'
    });
    requireModule('babel-polyfill');

    babelRegisterDone = true;
  }
};

export default class ReactNativePlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['react-native', 'webpack']);
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native', 'webpack'])) {
      registerBabel();

      const webpack = requireModule('webpack');

      const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf)$/;

      const AssetResolver = requireModule('haul/src/resolvers/AssetResolver');
      const HasteResolver = requireModule('haul/src/resolvers/HasteResolver');

      const reactNativeRule = {
        loader: requireModule.resolve('babel-loader'),
        options: {
          cacheDirectory: spin.dev,
          presets: [requireModule.resolve('babel-preset-expo')],
          plugins: [requireModule.resolve('haul/src/utils/fixRequireIssues')]
        }
      };

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.exclude = /node_modules\/(?!react-native|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/;
      const origUse = jsRule.use;
      jsRule.use = req => (req.resource.indexOf('node_modules') >= 0 ? reactNativeRule : origUse);

      builder.config.resolve.extensions = [`.${stack.platform}.`, '.native.', '.']
        .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
        .reduce((acc, val) => acc.concat(val));

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: mobileAssetTest,
              use: {
                loader: require.resolve('./react-native/assetLoader'),
                query: {
                  platform: stack.platform,
                  root: path.resolve('.'),
                  bundle: false
                }
              }
            }
          ]
        },
        resolve: {
          plugins: [
            new HasteResolver({
              directories: [path.resolve('node_modules/react-native')]
            }),
            new AssetResolver({
              platform: stack.platform,
              test: mobileAssetTest
            })
          ],
          mainFields: ['react-native', 'browser', 'main']
        }
      });

      const reactVer = requireModule('react-native/package.json').version.split('.')[1] >= 43 ? 16 : 15;
      if (stack.hasAny('dll')) {
        builder.config = spin.merge(builder.config, {
          entry: {
            vendor: [`spinjs/lib/plugins/react-native/react-native-polyfill-${reactVer}.js`]
          }
        });
      } else {
        const idx = builder.config.entry.index.indexOf('babel-polyfill');
        if (idx >= 0) {
          builder.config.entry.index.splice(idx, 1);
        }
        builder.config = spin.merge(
          {
            plugins: [
              new webpack.SourceMapDevToolPlugin({
                test: new RegExp(`\\.(${jsRuleFinder.extensions.join('|')}|css|bundle)($|\\?)`, 'i'),
                filename: '[file].map'
              })
            ],
            entry: {
              index: [`spinjs/lib/plugins/react-native/react-native-polyfill-${reactVer}.js`]
            }
          },
          builder.config
        );
      }
    }
  }
}
