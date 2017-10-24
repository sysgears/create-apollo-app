import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';

const postCssDefaultConfig = () => {
  return {
    plugins: () => [
      requireModule('autoprefixer')({
        browsers: ['last 2 versions', 'ie >= 9']
      })
    ]
  };
};

export default class CssProcessorPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;
    const dev = spin.dev;

    if (stack.hasAll('webpack') && !stack.hasAny('dll')) {
      let createRule;
      const rules = [];
      const postCssLoader = requireModule.probe('postcss-loader');
      const useDefaultPostCss: boolean = spin.options.useDefaultPostCss || false;
      if (stack.hasAny('server')) {
        createRule = (ext, ruleList) => ({
          test: new RegExp(`\\.${ext}$`),
          use: dev
            ? [
                { loader: requireModule.resolve('isomorphic-style-loader') },
                { loader: requireModule.resolve('css-loader'), options: { sourceMap: true } }
              ]
                .concat(
                  postCssLoader
                    ? {
                        loader: postCssLoader,
                        options: useDefaultPostCss
                          ? { ...postCssDefaultConfig(), sourceMap: true }
                          : { sourceMap: true }
                      }
                    : []
                )
                .concat(ruleList)
            : [{ loader: requireModule.resolve('ignore-loader') }]
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
                  { loader: requireModule.resolve('style-loader') },
                  { loader: requireModule.resolve('css-loader'), options: { sourceMap: true, importLoaders: 1 } }
                ]
                  .concat(
                    postCssLoader
                      ? {
                          loader: postCssLoader,
                          options: useDefaultPostCss
                            ? { ...postCssDefaultConfig(), sourceMap: true }
                            : { sourceMap: true }
                        }
                      : []
                  )
                  .concat(ruleList)
              : plugin.extract({
                  fallback: requireModule.resolve('style-loader'),
                  use: [
                    {
                      loader: requireModule.resolve('css-loader'),
                      options: { importLoaders: postCssLoader ? 1 : 0 }
                    }
                  ]
                    .concat(
                      postCssLoader
                        ? {
                            loader: postCssLoader,
                            options: useDefaultPostCss ? postCssDefaultConfig() : {}
                          } as any
                        : []
                    )
                    .concat(ruleList ? ruleList.map(rule => rule.loader) : [])
                })
          };
        };
      }

      if (createRule && stack.hasAny('css')) {
        rules.push(createRule('css', []));
      }

      if (createRule && stack.hasAny('sass')) {
        rules.push(
          createRule('scss', [{ loader: requireModule.resolve(`sass-loader`), options: { sourceMap: true } }])
        );
      }

      if (createRule && stack.hasAny('less')) {
        rules.push(
          createRule('less', [{ loader: requireModule.resolve(`less-loader`), options: { sourceMap: true } }])
        );
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules
        }
      });
    }
  }
}
