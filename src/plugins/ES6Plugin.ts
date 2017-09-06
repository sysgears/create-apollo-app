import requireModule from '../requireModule';
import { ConfigPlugin } from '../ConfigPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';
import findJSRule from './shared/JSRuleFinder';

export default class ES6Plugin implements ConfigPlugin {
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
                    ].concat(spin.dev && spin.options.reactHotLoader ? [requireModule.resolve('react-hot-loader/babel')] : []),
                    only: ['*.js'].concat(builder.stack.hasAny(['react', 'react-native']) ?  ['*.jsx'] : []),
                },
            };

            if (builder.stack.hasAny('es6') && !builder.stack.hasAny('dll')) {
                builder.config = spin.merge({
                    entry: {
                        index: [requireModule.resolve('babel-polyfill')],
                    },
                }, builder.config);
            }

            const jsRule = findJSRule(builder);
            jsRule.exclude = /node_modules/;
            jsRule.use = babelRule;
        }
    }
}