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
      const postCssLoader = builder.require.probe('postcss-loader') ? 'postcss-loader' : undefined;
      const useDefaultPostCss: boolean = builder.useDefaultPostCss || false;

      let plugin;

      if (stack.hasAny('server')) {
        createRule = (ext: string, nodeModules: boolean, ruleList: any[]) => ({
          test: nodeModules
            ? new RegExp(`^.*\\/node_modules\\/.*\\.${ext}$`)
            : new RegExp(`^(?!.*\\/node_modules\\/).*\\.${ext}$`),
          use: ([
            { loader: 'isomorphic-style-loader', options: spin.createConfig(builder, 'isomorphicStyle', {}) },
            { loader: 'css-loader', options: spin.createConfig(builder, 'css', { ...loaderOptions }) }
          ] as any[])
            .concat(
              postCssLoader && !nodeModules
                ? {
                    loader: postCssLoader,
                    options: spin.createConfig(
                      builder,
                      'postCss',
                      useDefaultPostCss ? { ...postCssDefaultConfig(builder), ...loaderOptions } : { ...loaderOptions }
                    )
                  }
                : []
            )
            .concat(ruleList)
        });
      } else if (stack.hasAny('web')) {
        const webpackVer = builder.require('webpack/package.json').version.split('.')[0];

        if (webpackVer < 4) {
          let ExtractCSSPlugin;
          if (!dev) {
            ExtractCSSPlugin = builder.require('extract-text-webpack-plugin');
          }
          createRule = (ext: string, nodeModules: boolean, ruleList: any[]) => {
            if (!dev && !plugin) {
              plugin = new ExtractCSSPlugin({ filename: `[name].[contenthash].css` });
            }
            return {
              test: nodeModules
                ? new RegExp(`^.*\\/node_modules\\/.*\\.${ext}$`)
                : new RegExp(`^(?!.*\\/node_modules\\/).*\\.${ext}$`),
              use: dev
                ? ([
                    { loader: 'style-loader', options: spin.createConfig(builder, 'style', {}) },
                    {
                      loader: 'css-loader',
                      options: spin.createConfig(builder, 'css', { ...loaderOptions, importLoaders: 1 })
                    }
                  ] as any[])
                    .concat(
                      postCssLoader && !nodeModules
                        ? {
                            loader: postCssLoader,
                            options: spin.createConfig(
                              builder,
                              'postCss',
                              useDefaultPostCss
                                ? { ...postCssDefaultConfig(builder), ...loaderOptions }
                                : { ...loaderOptions }
                            )
                          }
                        : []
                    )
                    .concat(ruleList)
                : plugin.extract({
                    fallback: 'style-loader',
                    use: [
                      {
                        loader: 'css-loader',
                        options: spin.createConfig(builder, 'css', {
                          importLoaders: postCssLoader && !nodeModules ? 1 : 0
                        })
                      }
                    ]
                      .concat(
                        postCssLoader && !nodeModules
                          ? {
                              loader: postCssLoader,
                              options: spin.createConfig(
                                builder,
                                'postCss',
                                useDefaultPostCss ? postCssDefaultConfig(builder) : {}
                              )
                            } as any
                          : []
                      )
                      .concat(ruleList ? ruleList.map(rule => rule.loader) : [])
                  })
            };
          };
        } else {
          let ExtractCSSPlugin;
          if (!dev) {
            ExtractCSSPlugin = builder.require('mini-css-extract-plugin');
          }
          createRule = (ext: string, nodeModules: boolean, ruleList: any[]) => {
            if (!dev && !plugin) {
              plugin = new ExtractCSSPlugin({
                chunkFilename: '[id].css',
                filename: `[name].[contenthash].css`
              });
            }
            return {
              test: nodeModules
                ? new RegExp(`^.*\\/node_modules\\/.*\\.${ext}$`)
                : new RegExp(`^(?!.*\\/node_modules\\/).*\\.${ext}$`),
              use: dev
                ? ([
                    { loader: 'style-loader', options: spin.createConfig(builder, 'style', {}) },
                    {
                      loader: 'css-loader',
                      options: spin.createConfig(builder, 'css', { ...loaderOptions, importLoaders: 1 })
                    }
                  ] as any[])
                    .concat(
                      postCssLoader && !nodeModules
                        ? {
                            loader: postCssLoader,
                            options: spin.createConfig(
                              builder,
                              'postCss',
                              useDefaultPostCss
                                ? { ...postCssDefaultConfig(builder), ...loaderOptions }
                                : { ...loaderOptions }
                            )
                          }
                        : []
                    )
                    .concat(ruleList)
                : [
                    { loader: ExtractCSSPlugin.loader, options: spin.createConfig(builder, 'mini-css-extract', {}) },
                    {
                      loader: 'css-loader',
                      options: spin.createConfig(builder, 'css', {
                        importLoaders: postCssLoader && !nodeModules ? 1 : 0
                      })
                    }
                  ]
                    .concat(
                      postCssLoader && !nodeModules
                        ? {
                            loader: postCssLoader,
                            options: spin.createConfig(
                              builder,
                              'postCss',
                              useDefaultPostCss ? postCssDefaultConfig(builder) : {}
                            )
                          } as any
                        : []
                    )
                    .concat(ruleList ? ruleList.map(rule => rule.loader) : [])
            };
          };
        }
      }

      if (createRule && stack.hasAny('css')) {
        rules.push(createRule('css', false, []), createRule('css', true, []));
      }

      if (createRule && stack.hasAny('sass')) {
        const sassRule = [{ loader: 'sass-loader', options: spin.createConfig(builder, 'sass', { ...loaderOptions }) }];
        rules.push(createRule('scss', false, sassRule), createRule('scss', true, sassRule));
      }

      if (createRule && stack.hasAny('less')) {
        const lessLoaderVer = builder.require('less-loader/package.json').version.split('.')[0];
        const options = lessLoaderVer >= 4 ? { javascriptEnabled: true, ...loaderOptions } : { ...loaderOptions };
        const lessRule = [{ loader: 'less-loader', options: spin.createConfig(builder, 'less', options) }];
        rules.push(createRule('less', false, lessRule), createRule('less', true, lessRule));
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
