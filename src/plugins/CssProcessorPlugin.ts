import Spin from "../Spin";
import { SpinPlugin } from "../SpinPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';

const createCssPreprocessorRules = (dev, stack): Array<Object> => {
    let createRule;

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
        createRule = (prep, ext) => ({
            test: new RegExp(`\.${ext}$`),
            use: dev ? [
                {loader: 'style-loader'},
                {loader: 'css-loader', options: {sourceMap: true, importLoaders: 1}},
                {loader: 'postcss-loader', options: {sourceMap: true}},
                {loader: `${prep}-loader`, options: {sourceMap: true}},
            ] : requireModule('extract-text-webpack-plugin').extract({
                fallback: 'style-loader',
                use: ['css-loader', 'postcss-loader', `${prep}-loader`],
            }),
        });
    }

    const rules = [];

    if (createRule && stack.hasAny('sass')) {
        rules.push(createRule('sass', 'scss'));
    }

    if (createRule && stack.hasAny('less')) {
        rules.push(createRule('less', 'less'));
    }

    return rules;
};

export default class CssProcessorPlugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin): Object {
        return {
            module: {
                rules: createCssPreprocessorRules(spin.dev, builder.stack)
            }
        };
    }
}