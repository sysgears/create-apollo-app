import Spin from "../Spin";
import { SpinPlugin } from "../SpinPlugin";
import { Builder } from "../Builder";
import findJSRule from './shared/JSRuleFinder';

export default class ReactPlugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['react', 'webpack'])) {
            const jsRule = findJSRule(builder);
            jsRule.test = /\.jsx?$/;

            builder.config = spin.merge(builder.config, {
                resolve: {
                    extensions: stack.hasAny('server') ?
                        [`.web.js`, `.web.jsx`, '.js', '.jsx'] :
                        [`.${stack.platform}.js`, `.${stack.platform}.jsx`, '.native.js', '.native.jsx', '.js', '.jsx'],
                }
            });
            if (stack.hasAny('web') && !stack.hasAny('dll')) {
                for (let idx = 0; idx < builder.config.entry.index.length; idx++) {
                    if (builder.config.entry.index[idx].endsWith('index.js')) {
                        builder.config.entry.index[idx] =
                            builder.config.entry.index[idx].replace('.js', '.jsx');
                    }
                }
            }
        }
    }
}