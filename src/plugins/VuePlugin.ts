import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';

export default class VuePlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['vue', 'webpack'])) {
            const webpack = requireModule('webpack');

            builder.config = spin.merge(builder.config, {
                module: {
                    rules: [{
                        test: /\.vue$/,
                        use: requireModule.resolve('vue-loader'),
                    }]
                },
                resolve: {
                    alias: {
                        'vue$': 'vue/dist/vue.esm.js'
                    }
                }
            });
        }
    }
}