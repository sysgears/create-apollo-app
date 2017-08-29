import requireModule from '../requireModule';
import { SpinPlugin } from '../SpinPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';

export default class ES6Plugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        if (builder.stack.hasAll(['es6', 'webpack'])) {
            const babelRule = {
                loader: requireModule.resolve('babel-loader'),
                options: {
                    cacheDirectory: spin.dev,
                    presets: [
                        requireModule.resolve('babel-preset-react'),
                        [requireModule.resolve('babel-preset-es2015'), {'modules': false}],
                        requireModule.resolve('babel-preset-stage-0')],
                    plugins: [
                        requireModule.resolve('babel-plugin-transform-runtime'),
                        requireModule.resolve('babel-plugin-transform-decorators-legacy'),
                        requireModule.resolve('babel-plugin-transform-class-properties'),
                        [requireModule.resolve('babel-plugin-styled-components'), {'ssr': spin.options.ssr}],
                    ].concat(spin.dev && spin.options.reactHotLoader ? [requireModule.resolve('react-hot-loader/babel')] : []),
                    only: ['*.js', '*.jsx'],
                },
            };

            if (builder.stack.hasAny('es6') && !builder.stack.hasAny('dll')) {
                builder.config = spin.merge({
                    entry: {
                        index: ['babel-polyfill'],
                    },
                }, builder.config);
            }

            let jsRule;
            for (let rule of builder.config.module.rules) {
                if (String(rule.test) === String(/\.jsx?$/)) {
                    jsRule = rule;
                    break;
                }
            }
            if (!jsRule) {
                jsRule = { test: /\.jsx?$/ };
                builder.config.module.rules = builder.config.module.rules.concat(jsRule);
            }
            jsRule.exclude = /node_modules/;
            jsRule.use = babelRule;
        }
    }
}