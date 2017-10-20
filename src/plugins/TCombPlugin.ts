import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TCombPlugin implements StackPlugin {
  public detect(builder, spin: Spin): boolean {
    return undefined;
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['tcomb', 'webpack']) && !stack.hasAny('dll')) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.rule;
      jsRule.use = spin.merge(jsRule.use, {
        options: {
          plugins: [[requireModule.resolve('babel-plugin-tcomb')]]
        }
      });
    }
  }
}
