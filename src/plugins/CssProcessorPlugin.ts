import Spin from "../Spin";
import { SpinPlugin } from "../SpinPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';

export default class CssProcessorPlugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;
        const dev = spin.dev;

        if (stack.hasAll('webpack')) {
            let createRule;
            let rules = [];
            if (stack.hasAny('server')) {
                createRule = (prep, ext) => ({
                    test: new RegExp(`\.${ext}$`),
                    use: dev ? [
                            {loader: 'isomorphic-style-loader'},
                            {loader: 'css-loader', options: {sourceMap: true}},
                            {loader: 'postcss-loader', options: {sourceMap: true}},
                            {loader: `${prep}-loader`, options: {sourceMap: true}}] :
                        [{loader: 'ignore-loader'}],
                });
            } else if (stack.hasAny('web')) {
                let ExtractTextPlugin;
                if (!dev) {
                    ExtractTextPlugin = requireModule('extract-text-webpack-plugin');
                    builder.config.plugins.push(new ExtractTextPlugin({filename: '[name].[contenthash].css', allChunks: true}));
                }
                createRule = (prep, ext) => ({
                    test: new RegExp(`\.${ext}$`),
                    use: dev ? [
                        {loader: 'style-loader'},
                        {loader: 'css-loader', options: {sourceMap: true, importLoaders: 1}},
                        {loader: 'postcss-loader', options: {sourceMap: true}},
                        {loader: `${prep}-loader`, options: {sourceMap: true}},
                    ] : ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: ['css-loader', 'postcss-loader', `${prep}-loader`],
                    }),
                });
            }

            if (createRule && stack.hasAny('sass')) {
                rules.push(createRule('sass', 'scss'));
            }

            if (createRule && stack.hasAny('less')) {
                rules.push(createRule('less', 'less'));
            }

            builder.config = spin.merge(builder.config, {
                module: {
                    rules
                }
            });
        }
    }
}