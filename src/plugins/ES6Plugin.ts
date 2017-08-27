import requireModule from '../requireModule';
import { SpinPlugin } from '../SpinPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';

export default class ES6Plugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        if (builder.stack.hasAny(['es6', 'react-native'])) {
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

            let reactNativeRule;

            if (builder.stack.hasAny('es6') && !builder.stack.hasAny(['dll', 'react-native'])) {
                builder.config = spin.merge({
                    entry: {
                        index: ['babel-polyfill'],
                    },
                }, builder.config);
            }
            if (builder.stack.hasAny('react-native')) {
                reactNativeRule = {
                    loader: requireModule.resolve('babel-loader'),
                    options: {
                        cacheDirectory: spin.dev,
                        presets: [requireModule.resolve('babel-preset-react-native')],
                        plugins: [
                            requireModule.resolve('haul/src/utils/fixRequireIssues'),
                        ],
                    },
                };
                if (!builder.stack.hasAny('dll')) {
                    builder.config = spin.merge({
                        entry: {
                            index: [require.resolve('../react-native/react-native-polyfill.js')],
                        },
                    }, builder.config);
                }
            }

            let jsRule;
            for (let rule of builder.config.module.rules) {
                if (String(rule.test) === String(/\.jsx?$/)) {
                    jsRule = rule;
                    break;
                }
            }
            if (!jsRule) {
                jsRule = { test: /\.jsx?$/};
                builder.config.module.rules = builder.config.module.rules.concat(jsRule);
            }
            jsRule.exclude = builder.stack.hasAny(['react-native']) ?
                /node_modules\/(?!react-native|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/ :
                /node_modules/;
            jsRule.use = [
                (builder.stack.hasAny(['react-native']) ?
                    function (req) {
                        let result;
                        if (req.resource.indexOf('node_modules') >= 0) {
                            result = reactNativeRule;
                        } else {
                            result = babelRule;
                        }
                        return result;
                    } :
                    babelRule) as any,
                ];
        }
    }
}