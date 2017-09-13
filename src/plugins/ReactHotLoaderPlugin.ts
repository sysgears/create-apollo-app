import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';
import findJSRule from './shared/JSRuleFinder';

export default class ReactHotLoaderPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['react-hot-loader', 'webpack'])
            && spin.dev && !spin.test && !stack.hasAny('dll')) {
            builder.config = spin.mergeWithStrategy({
                entry: 'prepend',
            }, builder.config, {
                entry: {
                    index: [
                        requireModule.resolve('react-hot-loader/patch')
                    ]
                }
            });
            const jsRule = findJSRule(builder);
            const isBabelUsed = jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0;
            jsRule.use = spin.merge(jsRule.use, {
                options: {
                    plugins: [requireModule.resolve(isBabelUsed ? 'react-hot-loader/babel' : 'react-hot-loader/webpack')]
                }
            })
        }
    }
}