import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TCombPlugin implements ConfigPlugin {
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
