import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class StyledComponentsPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (
      stack.hasAll(['styled-components', 'webpack']) &&
      (stack.hasAny('web') || (stack.hasAny('server') && builder.ssr))
    ) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findJSRule();
      if (jsRule && !jsRule.use.options.babelrc) {
        jsRule.use = spin.merge(jsRule.use, {
          options: {
            plugins: [['babel-plugin-styled-components', { ssr: builder.ssr }]]
          }
        });
      }
    }
  }
}
