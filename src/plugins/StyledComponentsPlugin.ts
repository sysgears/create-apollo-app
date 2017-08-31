import Spin from "../Spin";
import { SpinPlugin } from "../SpinPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';
import findJSRule from './shared/JSRuleFinder';

export default class StyledComponentsPlugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['styled-components', 'webpack']) &&
            (stack.hasAny('web') || (stack.hasAny('server') && spin.options.ssr))) {

            const jsRule = findJSRule(builder);
            jsRule.use = spin.merge(jsRule.use, {
                options: {
                    plugins: [
                        [requireModule.resolve('babel-plugin-styled-components'), {'ssr': spin.options.ssr}],
                    ],
                },
            });
        }
    }
}