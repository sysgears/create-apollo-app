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
            builder.config = spin.merge(builder.config, {
                module: {
                    rules: [{
                        test: jsRule.test,
                        use: requireModule.resolve('angular2-template-loader'),
                    }]
                }
            });

            if (!stack.hasAny('dll') && stack.hasAny('web')) {
                builder.config = spin.merge({
                    entry: {
                        index: [
                            require.resolve('./angular/angular-polyfill.js')
                        ],
                    },
                }, builder.config);
            }
        }
    }
}