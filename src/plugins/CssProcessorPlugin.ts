import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

const postCssDefaultConfig = (builder: Builder) => {
  return {
    plugins: () => [
      builder.require('autoprefixer')({
        browsers: ['last 2 versions', 'ie >= 9']
      })
    ]
  };
};

export default class CssProcessorPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;
    const dev = spin.dev;
    const loaderOptions = builder.sourceMap ? { sourceMap: true } : {};

    if (stack.hasAll('webpack') && !stack.hasAny('dll')) {
      let createRule;
      const rules = [];
      const postCssLoader = builder.require.probe('postcss-loader');
      const useDefaultPostCss: boolean = builder.useDefaultPostCss || false;

      let plugin;

      if (stack.hasAny('server')) {
        createRule = (ext, ruleList) => ({
          test: new RegExp(`\\.${ext}$`),
          use: [
            { loader: builder.require.resolve('isomorphic-style-loader') },
            { loader: builder.require.resolve('css-loader'), options: { ...loaderOptions } }
          ]
            .concat(
              postCssLoader
                ? {
                    loader: postCssLoader,
                    options: useDefaultPostCss
                      ? { ...postCssDefaultConfig(builder), ...loaderOptions }
                      : { ...loaderOptions }
                  }
                : []
            )
            .concat(ruleList)
        });
      } else if (stack.hasAny('web')) {
        let ExtractTextPlugin;
        if (!dev) {
          ExtractTextPlugin = builder.require('extract-text-webpack-plugin');
        }
        createRule = (ext, ruleList) => {
          if (!dev && !plugin) {
            plugin = new ExtractTextPlugin({ filename: `[name].[contenthash].css` });
          }
          return {
            test: new RegExp(`\\.${ext}$`),
            use: dev
              ? [
                  { loader: builder.require.resolve('style-loader') },
                  { loader: builder.require.resolve('css-loader'), options: { ...loaderOptions, importLoaders: 1 } }
                ]
                  .concat(
                    postCssLoader
                      ? {
                          loader: postCssLoader,
                          options: useDefaultPostCss
                            ? { ...postCssDefaultConfig(builder), ...loaderOptions }
                            : { ...loaderOptions }
                        }
                      : []
                  )
                  .concat(ruleList)
              : plugin.extract({
                  fallback: builder.require.resolve('style-loader'),
                  use: [
                    {
                      loader: builder.require.resolve('css-loader'),
                      options: { importLoaders: postCssLoader ? 1 : 0 }
                    }
                  ]
                    .concat(
                      postCssLoader
                        ? {
                            loader: postCssLoader,
                            options: useDefaultPostCss ? postCssDefaultConfig(builder) : {}
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
          createRule('scss', [{ loader: builder.require.resolve(`sass-loader`), options: { ...loaderOptions } }])
        );
      }

      if (createRule && stack.hasAny('less')) {
        rules.push(
          createRule('less', [{ loader: builder.require.resolve(`less-loader`), options: { ...loaderOptions } }])
        );
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules
        }
      });

      if (plugin) {
        builder.config.plugins.push(plugin);
      }
    }
  }
}
