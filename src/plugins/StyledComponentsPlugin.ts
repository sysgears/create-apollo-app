import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class StyledComponentsPlugin implements StackPlugin {
  public detect(builder, spin: Spin): boolean {
    return builder.stack.hasAll(['styled-components', 'webpack']);
  }

  public init(builder: any, spin: Spin): InitConfig {
    return {
      dependencies: ['styled-components'],
      devDependencies: ['babel-plugin-styled-components']
    };
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAny('web') || (stack.hasAny('server') && spin.options.ssr)) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.rule;
      jsRule.use = spin.merge(jsRule.use, {
        options: {
          plugins: [[requireModule.resolve('babel-plugin-styled-components'), { ssr: spin.options.ssr }]]
        }
      });
    }
  }
}
