import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';
import JSRuleFinder from './shared/JSRuleFinder';

export default class AngularPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['angular', 'webpack'])) {
            const jsRuleFinder = new JSRuleFinder(builder);
            const jsRule = jsRuleFinder.rule;
            jsRule.use = spin.merge(jsRule.use, {
            });
        }
    }
}