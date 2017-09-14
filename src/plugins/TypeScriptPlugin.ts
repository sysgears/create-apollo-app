import requireModule from '../requireModule';
import { ConfigPlugin } from '../ConfigPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';
import findJSRule from './shared/JSRuleFinder';

export default class TypeScriptPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        if (builder.stack.hasAll(['typescript', 'webpack'])) {
            const jsRule = findJSRule(builder);
            jsRule.use = spin.merge(jsRule.use, {
            });
        }
    }
}