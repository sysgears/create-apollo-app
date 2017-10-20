import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ReactHotLoaderPlugin implements StackPlugin {
  public detect(builder: any, spin: Spin): boolean {
    return builder.stack.hasAll(['react-hot-loader', 'webpack']) && !builder.stack.hasAny('dll');
  }

  public configure(builder: Builder, spin: Spin) {
    if (spin.dev && !spin.test) {
      builder.config = spin.mergeWithStrategy(
        {
          entry: 'prepend'
        },
        builder.config,
        {
          entry: {
            index: [requireModule.resolve('react-hot-loader/patch')]
          }
        }
      );
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.rule;
      const isBabelUsed = jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0;
      jsRule.use = spin.merge(jsRule.use, {
        options: {
          plugins: [requireModule.resolve(isBabelUsed ? 'react-hot-loader/babel' : 'react-hot-loader/webpack')]
        }
      });
    }
  }
}
