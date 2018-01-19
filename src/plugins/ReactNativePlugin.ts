import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

let babelRegisterDone = false;

const registerBabel = (spin: Spin) => {
  if (!babelRegisterDone) {
    spin.require('babel-register')({
      presets: [spin.require.resolve('babel-preset-env'), spin.require.resolve('babel-preset-flow')],
      ignore: /node_modules(?!\/(haul|react-native))/,
      retainLines: true,
      sourceMaps: 'inline'
    });
    spin.require('babel-polyfill');

    babelRegisterDone = true;
  }
};

export default class ReactNativePlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native', 'webpack'])) {
      registerBabel(spin);

      const webpack = spin.require('webpack');

      const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf)$/;

      const AssetResolver = spin.require('haul/src/resolvers/AssetResolver');
      const HasteResolver = spin.require('haul/src/resolvers/HasteResolver');

      const reactNativeRule = {
        loader: spin.require.resolve('babel-loader'),
        options: {
          babelrc: false,
          cacheDirectory: spin.dev,
          compact: !spin.dev,
          presets: ([spin.require.resolve('babel-preset-expo')] as any[]).concat(
            spin.dev ? [] : [[spin.require.resolve('babel-preset-minify'), { mangle: false }]]
          ),
          plugins: [spin.require.resolve('haul/src/utils/fixRequireIssues')]
        }
      };

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.exclude = /node_modules\/(?!react-native.*|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/;
      const origUse = jsRule.use || require.resolve('./shared/identity-loader');
      jsRule.use = req => (req.resource.indexOf('node_modules') >= 0 ? reactNativeRule : origUse);

      builder.config.resolve.extensions = [`.${stack.platform}.`, '.native.', '.']
        .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
        .reduce((acc, val) => acc.concat(val));

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            { parser: { requireEnsure: false } },
            {
              test: mobileAssetTest,
              use: {
                loader: require.resolve('./react-native/assetLoader'),
                query: {
                  platform: stack.platform,
                  root: path.resolve('.'),
                  cwd: spin.cwd,
                  bundle: false
                }
              }
            }
          ]
        },
        resolve: {
          plugins: [
            new HasteResolver({
              directories: [spin.require.resolve('react-native')]
            }),
            new AssetResolver({
              platform: stack.platform,
              test: mobileAssetTest
            })
          ],
          mainFields: ['react-native', 'browser', 'main']
        },
        target: 'webworker'
      });

      const reactVer = spin.require('react-native/package.json').version.split('.')[1] >= 43 ? 16 : 15;
      if (stack.hasAny('dll')) {
        builder.config = spin.merge(builder.config, {
          entry: {
            vendor: [spin.require.resolve(`spinjs/react-native-polyfills/react-native-polyfill-${reactVer}.js`)]
          }
        });
      } else {
        const idx = builder.config.entry.index.indexOf('babel-polyfill');
        if (idx >= 0) {
          builder.config.entry.index.splice(idx, 1);
        }
        builder.config = spin.merge(
          {
            plugins: builder.sourceMap
              ? [
                  new webpack.SourceMapDevToolPlugin({
                    test: new RegExp(`\\.bundle$`),
                    filename: '[file].map'
                  })
                ]
              : [],
            entry: {
              index: [spin.require.resolve(`spinjs/react-native-polyfills/react-native-polyfill-${reactVer}.js`)]
            }
          },
          builder.config
        );
      }
    }
  }
}
