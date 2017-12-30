import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TCombPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['tcomb', 'webpack']) && !stack.hasAny('dll')) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findJSRule();
      if (jsRule) {
        jsRule.use = spin.merge(jsRule.use, {
          options: {
            plugins: [[spin.require.resolve('babel-plugin-tcomb')]]
          }
        });
      }
    }
  }
}
