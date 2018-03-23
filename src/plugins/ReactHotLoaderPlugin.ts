import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ReactHotLoaderPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react-hot-loader', 'webpack']) && spin.dev && !spin.test && !stack.hasAny('dll')) {
      builder.config = spin.mergeWithStrategy(
        {
          entry: 'prepend'
        },
        builder.config,
        {
          entry: {
            index: ['react-hot-loader/patch']
          }
        }
      );
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      const isBabelUsed = jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0;
      jsRule.use = spin.merge(jsRule.use, {
        options: {
          plugins: [isBabelUsed ? 'react-hot-loader/babel' : 'react-hot-loader/webpack']
        }
      });
    }
  }
}
