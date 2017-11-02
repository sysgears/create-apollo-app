import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class FlowRuntimePLugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['flow-runtime', 'webpack']) && !stack.hasAny('dll')) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      jsRule.use = spin.merge(jsRule.use, {
        options: {
          plugins: [
            [
              requireModule.resolve('babel-plugin-flow-runtime'),
              {
                assert: true,
                annotate: true
              }
            ]
          ]
        }
      });
    }
  }
}
