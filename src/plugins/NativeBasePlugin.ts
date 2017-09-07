import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import findJSRule from './shared/JSRuleFinder';

export default class NativeBasePlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['native-base', 'react-native', 'webpack'])) {

            const jsRule = findJSRule(builder);
            jsRule.exclude = [/node_modules\/(?!native-base)$/].concat(jsRule.exclude);
        }
    }
}