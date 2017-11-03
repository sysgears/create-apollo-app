import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ES6Plugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['es6', 'webpack']);
  }

  public configure(builder: Builder, spin: Spin) {
    if (builder.stack.hasAll(['es6', 'webpack'])) {
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
        loader: requireModule.resolve('babel-loader'),
        options: {
          cacheDirectory: spin.dev,
          presets: [
            requireModule.resolve('babel-preset-react'),
            [requireModule.resolve('babel-preset-es2015'), { modules: false }],
            requireModule.resolve('babel-preset-stage-0')
          ],
          plugins: [
            requireModule.resolve('babel-plugin-transform-runtime'),
            requireModule.resolve('babel-plugin-transform-decorators-legacy'),
            requireModule.resolve('babel-plugin-transform-class-properties')
          ],
          only: jsRuleFinder.extensions.map(ext => '*.' + ext)
        }
      };
    }
  }
}
