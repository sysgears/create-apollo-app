import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ES6Plugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    if (
      builder.stack.hasAll(['es6', 'webpack']) &&
      (!builder.stack.hasAny('dll') || builder.stack.hasAny(['android', 'ios']))
    ) {
      if (builder.stack.hasAny('es6') && !builder.stack.hasAny('dll')) {
        builder.config = spin.merge(
          {
            entry: {
              index: ['babel-polyfill']
            }
          },
          builder.config
        );
      }

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.exclude = /node_modules/;
      jsRule.use = {
        loader: spin.require.resolve('babel-loader'),
        options: {
          babelrc: false,
          cacheDirectory: (builder.cache === 'auto' ? spin.dev : builder.cache) ? '.cache/babel-loader' : false,
          compact: !spin.dev,
          presets: ([
            spin.require.resolve('babel-preset-react'),
            [spin.require.resolve('babel-preset-env'), { modules: false }],
            spin.require.resolve('babel-preset-stage-0')
          ] as any[]).concat(spin.dev ? [] : [[spin.require.resolve('babel-preset-minify'), { mangle: false }]]),
          plugins: [
            spin.require.resolve('babel-plugin-transform-runtime'),
            spin.require.resolve('babel-plugin-transform-decorators-legacy'),
            spin.require.resolve('babel-plugin-transform-class-properties')
          ],
          only: jsRuleFinder.extensions.map(ext => '*.' + ext)
        }
      };
    }
  }
}
