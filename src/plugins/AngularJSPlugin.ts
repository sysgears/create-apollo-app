import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';
import findJSRule from './shared/JSRuleFinder';

export default class AngularJSPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['angularjs', 'webpack'])) {
            const jsRule = findJSRule(builder);
            jsRule.use = spin.merge(jsRule.use, {
            });
        }
    }
}