import * as humps from 'humps';
import * as ip from 'ip';
import * as path from 'path';
import * as url from 'url';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

const __WINDOWS__ = /^win/.test(process.platform);

const createPlugins = (builder: Builder, spin: Spin) => {
  const stack = builder.stack;
  const webpack = builder.require('webpack');
  const buildNodeEnv = process.env.NODE_ENV || (spin.dev ? (spin.test ? 'test' : 'development') : 'production');

  let plugins = [];

  if (spin.dev) {
    plugins.push(new webpack.NamedModulesPlugin());
    if (stack.hasAny(['server', 'web']) && !spin.test) {
      plugins.push(new webpack.HotModuleReplacementPlugin());
      plugins.push(new webpack.NoEmitOnErrorsPlugin());
    }
  } else {
    const uglifyOpts: any = builder.sourceMap ? { sourceMap: true } : {};
    if (stack.hasAny('angular')) {
      // https://github.com/angular/angular/issues/10618
      uglifyOpts.mangle = { keep_fnames: true };
    }
    const UglifyJsPlugin = builder.require('uglifyjs-webpack-plugin');
    plugins.push(new UglifyJsPlugin(uglifyOpts));
    const loaderOpts: any = { minimize: true };
    if (stack.hasAny('angular')) {
      loaderOpts.htmlLoader = {
        minimize: false // workaround for ng2
      };
    }
    plugins.push(new webpack.LoaderOptionsPlugin(loaderOpts));
    plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
  }

  const backendOption = builder.backendUrl;
  const defines: any = {};
  if (backendOption) {
    defines.__BACKEND_URL__ = `'${backendOption.replace('{ip}', ip.address())}'`;
  }

  if (stack.hasAny('dll')) {
    const name = `vendor_${humps.camelize(builder.parent.name)}`;
    plugins = [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': `"${buildNodeEnv}"`,
        ...defines,
        ...builder.defines
      }),
      new webpack.DllPlugin({
        name,
        path: path.join(builder.dllBuildDir, `${name}_dll.json`)
      })
    ];
  } else {
    if (stack.hasAny('server')) {
      plugins = plugins.concat([
        new webpack.BannerPlugin({
          banner: 'require("source-map-support").install();',
          raw: true,
          entryOnly: false
        }),
        new webpack.DefinePlugin({
          __CLIENT__: false,
          __SERVER__: true,
          __SSR__: builder.ssr && !spin.test,
          __DEV__: spin.dev,
          __TEST__: spin.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          ...defines,
          ...builder.defines
        })
      ]);
    } else {
      plugins = plugins.concat([
        new webpack.DefinePlugin({
          __CLIENT__: true,
          __SERVER__: false,
          __SSR__: builder.ssr && !spin.test,
          __DEV__: spin.dev,
          __TEST__: spin.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          ...defines,
          ...builder.defines
        })
      ]);

      if (stack.hasAny('web')) {
        const ManifestPlugin = builder.require('webpack-manifest-plugin');
        plugins.push(
          new ManifestPlugin({
            fileName: 'assets.json'
          })
        );

        if (!builder.ssr) {
          const HtmlWebpackPlugin = builder.require('html-webpack-plugin');
          plugins.push(
            new HtmlWebpackPlugin({
              template: builder.htmlTemplate || path.join(__dirname, '../../html-plugin-template.ejs'),
              inject: 'body'
            })
          );
        }

        const webpackVer = builder.require('webpack/package.json').version.split('.')[0];

        if (webpackVer < 4 && !spin.dev) {
          plugins.push(
            new webpack.optimize.CommonsChunkPlugin({
              name: 'vendor',
              filename: '[name].[hash].js',
              minChunks(module) {
                return module.resource && module.resource.indexOf(path.join(builder.require.cwd, 'node_modules')) === 0;
              }
            })
          );
        }
      }
    }
  }

  return plugins;
};

const getDepsForNode = (spin: Spin, builder: Builder): string[] => {
  const pkg = builder.require('./package.json');
  const deps = [];
  for (const key of Object.keys(pkg.dependencies)) {
    const val = builder.depPlatforms[key];
    let excluded = false;
    for (const regexp of builder.dllExcludes) {
      if (new RegExp(regexp).test(key)) {
        excluded = true;
      }
    }
    if (
      !excluded &&
      key.indexOf('@types') !== 0 &&
      (!val || (val.constructor === Array && val.indexOf(builder.parent.name) >= 0) || val === builder.parent.name)
    ) {
      const resolves = builder.require.probe(key);
      const exists = builder.require.probe(key + '/package.json');
      if (resolves && resolves.endsWith('.js')) {
        deps.push(key);
      } else if (!resolves && !exists) {
        throw new Error(`Cannot find module '${key}'`);
      }
    }
  }
  return deps;
};

let curWebpackDevPort = 3000;
const webpackPortMap = {};

const createConfig = (builder: Builder, spin: Spin) => {
  const stack = builder.stack;

  const cwd = process.cwd();

  const baseConfig: any = {
    name: builder.name,
    module: {
      rules: []
    },
    resolve: { symlinks: false },
    watchOptions: {
      ignored: /build/
    },
    bail: !spin.dev,
    stats: {
      hash: false,
      version: false,
      timings: true,
      assets: false,
      chunks: false,
      modules: false,
      reasons: false,
      children: false,
      source: true,
      errors: true,
      errorDetails: true,
      warnings: true,
      publicPath: false,
      colors: true
    }
  };

  const webpackVer = builder.require('webpack/package.json').version.split('.')[0];

  if (webpackVer >= 4) {
    baseConfig.mode = !spin.dev ? 'production' : 'development';
  }
  if (builder.sourceMap) {
    baseConfig.devtool = spin.dev ? '#cheap-module-source-map' : '#nosources-source-map';
    baseConfig.output = {
      devtoolModuleFilenameTemplate: spin.dev
        ? info => 'webpack:///./' + path.relative(cwd, info.absoluteResourcePath.split('?')[0]).replace(/\\/g, '/')
        : info => path.relative(cwd, info.absoluteResourcePath)
    };
  }

  const baseDevServerConfig = {
    hot: true,
    publicPath: '/',
    headers: { 'Access-Control-Allow-Origin': '*' },
    quiet: false,
    noInfo: true,
    historyApiFallback: true
  };

  const plugins = createPlugins(builder, spin);
  let config = {
    ...baseConfig,
    plugins
  };

  if (stack.hasAny('server')) {
    config = {
      ...config,
      target: 'node',
      externals: (context, request, callback) => {
        if (request.indexOf('webpack') < 0 && request.indexOf('babel-polyfill') < 0 && !request.startsWith('.')) {
          const fullPath = builder.require.probe(request, context);
          if (fullPath) {
            const ext = path.extname(fullPath);
            if (fullPath.indexOf('node_modules') >= 0 && ['.js', '.jsx', '.json'].indexOf(ext) >= 0) {
              return callback(null, 'commonjs ' + request);
            }
          }
        }
        return callback();
      }
    };
    if (builder.sourceMap) {
      config.output = {
        devtoolModuleFilenameTemplate: spin.dev
          ? ({ resourcePath }) => path.join(builder.require.cwd, resourcePath)
          : info => path.relative(cwd, info.absoluteResourcePath)
      };
    }
  } else {
    config = {
      ...config,
      node: {
        __dirname: true,
        __filename: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty'
      }
    };
  }

  if (stack.hasAny('dll')) {
    const name = `vendor_${humps.camelize(builder.parent.name)}`;
    config = {
      ...config,
      entry: {
        vendor: getDepsForNode(spin, builder)
      },
      output: {
        ...config.output,
        filename: `${name}_[hash]_dll.js`,
        path: path.join(builder.require.cwd, builder.dllBuildDir),
        library: name
      },
      bail: true
    };
    if (stack.hasAny('web')) {
      config.entry.vendor.push('webpack-dev-server/client');
    }
    if (builder.sourceMap) {
      config.devtool = spin.dev ? '#cheap-module-source-map' : '#nosources-source-map';
    }
  } else {
    if (spin.dev) {
      config.module.unsafeCache = false;
      config.resolve.unsafeCache = false;
    }
    if (stack.hasAny('server')) {
      const index = [];
      if (spin.dev && !spin.test) {
        if (__WINDOWS__) {
          index.push('webpack/hot/poll?1000');
        } else {
          index.push('webpack/hot/signal.js');
        }
      }
      index.push(builder.entry || './src/server/index.js');

      config = {
        ...config,
        entry: {
          index
        },
        output: {
          ...config.output,
          filename: '[name].js',
          path: path.join(builder.require.cwd, builder.buildDir || builder.backendBuildDir || 'build/server'),
          publicPath: '/'
        }
      };
      if (builder.sourceMap && spin.dev) {
        // TODO: rollout proper source map handling during Webpack HMR on a server code
        // Use that to improve situation with source maps of hot reloaded server code
        config.output.sourceMapFilename = '[name].[chunkhash].js.map';
      }
    } else if (stack.hasAny('web')) {
      let webpackDevPort;
      if (!builder.webpackDevPort) {
        if (!webpackPortMap[builder.name]) {
          webpackPortMap[builder.name] = curWebpackDevPort++;
        }
        webpackDevPort = webpackPortMap[builder.name];
      } else {
        webpackDevPort = builder.webpackDevPort;
      }

      config = {
        ...config,
        entry: {
          index: (spin.dev
            ? ['webpack/hot/dev-server', `webpack-dev-server/client?http://localhost:${webpackDevPort}/`]
            : []
          ).concat([builder.entry || './src/client/index.js'])
        },
        output: {
          ...config.output,
          filename: '[name].[hash].js',
          path: builder.buildDir
            ? path.join(builder.require.cwd, builder.buildDir)
            : path.join(builder.require.cwd, builder.frontendBuildDir || 'build/client', 'web'),
          publicPath: '/'
        },
        devServer: {
          ...baseDevServerConfig,
          port: webpackDevPort
        }
      };
      if (webpackVer >= 4 && !spin.dev) {
        config = {
          ...config,
          optimization: {
            splitChunks: {
              cacheGroups: {
                commons: {
                  test: /[\\/]node_modules[\\/]/,
                  name: 'vendor',
                  chunks: 'all'
                }
              }
            }
          }
        };
      }
      if (builder.devProxy) {
        const proxyUrl =
          typeof builder.devProxy === 'string'
            ? builder.devProxy
            : builder.backendUrl
              ? `http://localhost:${url.parse(builder.backendUrl).port}`
              : `http://localhost:8080`;
        config.devServer.proxy = {
          '!/*.hot-update.{json,js}': {
            target: proxyUrl,
            logLevel: 'info'
          }
        };
      }
    } else if (stack.hasAny('react-native')) {
      config = {
        ...config,
        entry: {
          index: [builder.entry || './src/mobile/index.js']
        },
        output: {
          ...config.output,
          filename: `index.mobile.bundle`,
          publicPath: '/',
          path: builder.buildDir
            ? path.join(builder.require.cwd, builder.buildDir)
            : path.join(builder.require.cwd, builder.frontendBuildDir || 'build/client', builder.name)
        },
        devServer: {
          ...baseDevServerConfig,
          hot: false,
          port: stack.hasAny('android') ? 3010 : 3020
        }
      };
    } else {
      throw new Error(`Unknown platform target: ${stack.platform}`);
    }
  }

  return config;
};

export default class WebpackPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAny('webpack')) {
      builder.config = builder.config || {};
      builder.config = spin.merge(builder.config, createConfig(builder, spin));
    }
  }
}
