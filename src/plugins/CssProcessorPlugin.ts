import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';

export default class CssProcessorPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;
    const dev = spin.dev;

    if (stack.hasAll('webpack')) {
      let createRule;
      const rules = [];
      if (stack.hasAny('server')) {
        createRule = (ext, ruleList) => ({
          test: new RegExp(`\\.${ext}$`),
          use: dev
            ? [
                { loader: 'isomorphic-style-loader' },
                { loader: 'css-loader', options: { sourceMap: true } },
                { loader: 'postcss-loader', options: { sourceMap: true } }
              ].concat(ruleList)
            : [{ loader: 'ignore-loader' }]
        });
      } else if (stack.hasAny('web')) {
        let ExtractTextPlugin;
        if (!dev) {
          ExtractTextPlugin = requireModule('extract-text-webpack-plugin');
        }
        createRule = (ext, ruleList) => {
          let plugin;
          if (!dev) {
            plugin = new ExtractTextPlugin({ filename: `[name].[contenthash]_${ext}.css` });
            builder.config.plugins.push(plugin);
          }
          return {
            test: new RegExp(`\\.${ext}$`),
            use: dev
              ? [
                  { loader: 'style-loader' },
                  { loader: 'css-loader', options: { sourceMap: true, importLoaders: 1 } },
                  { loader: 'postcss-loader', options: { sourceMap: true } }
                ].concat(ruleList)
              : plugin.extract({
                  fallback: 'style-loader',
                  use: ['css-loader', 'postcss-loader'].concat(ruleList ? ruleList.map(rule => rule.loader) : [])
                })
          };
        };
      }

      if (createRule) {
        rules.push(createRule('css', []));
      }

      if (createRule && stack.hasAny('sass')) {
        rules.push(createRule('scss', [{ loader: `sass-loader`, options: { sourceMap: true } }]));
      }

      if (createRule && stack.hasAny('less')) {
        rules.push(createRule('less', [{ loader: `less-loader`, options: { sourceMap: true } }]));
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules
        }
      });
    }
  }
}
