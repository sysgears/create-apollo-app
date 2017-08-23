import requireModule from '../requireModule';
import { SpinPlugin } from '../SpinPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';

export default class ES6Plugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin): Object {
        const rules = [];

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
            }

            rules.push(                {
                    test: /\.jsx?$/,
                    exclude: builder.stack.hasAny(['react-native']) ?
                        /node_modules\/(?!react-native|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/ :
                        /node_modules/,
                    use: [
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
                    ],
                },
            );
        }
        return {
            module: {
                rules,
            }
        };
    }
}