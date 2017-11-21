import * as ip from 'ip';
import * as path from 'path';
import * as url from 'url';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';

const pkg = requireModule('./package.json');

const __WINDOWS__ = /^win/.test(process.platform);

const createPlugins = (builder: Builder, spin: Spin) => {
  const stack = builder.stack;
  const webpack = requireModule('webpack');
  const buildNodeEnv = process.env.NODE_ENV || (spin.dev ? (spin.test ? 'test' : 'development') : 'production');

  let plugins = [];

  if (spin.dev) {
    plugins.push(new webpack.NamedModulesPlugin());
    if (stack.hasAny(['server', 'web']) && !spin.test) {
      plugins.push(new webpack.HotModuleReplacementPlugin());
      plugins.push(new webpack.NoEmitOnErrorsPlugin());
    }
  } else {
    const uglifyOpts: any = {};
    if (stack.hasAny('angular')) {
      // https://github.com/angular/angular/issues/10618
      uglifyOpts.mangle = { keep_fnames: true };
    }
    const UglifyJsPlugin = requireModule('uglifyjs-webpack-plugin');
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

  const backendUrl = builder.backendUrl.replace('{ip}', ip.address());

  if (stack.hasAny('dll')) {
    const name = `vendor_${builder.parent.name}`;
    plugins = [
      new webpack.DefinePlugin({
        __DEV__: spin.dev,
        __TEST__: spin.test,
        'process.env.NODE_ENV': `"${buildNodeEnv}"`
      }),
      new webpack.DllPlugin({
        name,
        path: path.join(spin.options.dllBuildDir, `${name}_dll.json`)
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
          __SSR__: spin.options.ssr && !spin.test,
          __DEV__: spin.dev,
          __TEST__: spin.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          __BACKEND_URL__: `"${backendUrl}"`,
          ...spin.options.defines
        })
      ]);
    } else {
      plugins = plugins.concat([
        new webpack.DefinePlugin({
          __CLIENT__: true,
          __SERVER__: false,
          __SSR__: spin.options.ssr && !spin.test,
          __DEV__: spin.dev,
          __TEST__: spin.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          __BACKEND_URL__: `"${backendUrl}"`,
          ...spin.options.defines
        })
      ]);

      if (stack.hasAny('web')) {
        const ManifestPlugin = requireModule('webpack-manifest-plugin');
        plugins.push(
          new ManifestPlugin({
            fileName: 'assets.json'
          })
        );

        if (!spin.options.ssr) {
          const HtmlWebpackPlugin = requireModule('html-webpack-plugin');
          plugins.push(
            new HtmlWebpackPlugin({
              template: builder.htmlTemplate || path.join(__dirname, '../../html-plugin-template.ejs'),
              inject: 'body'
            })
          );
        }

        if (!spin.dev) {
          plugins.push(
            new webpack.optimize.CommonsChunkPlugin({
              name: 'vendor',
              filename: '[name].[hash].js',
              minChunks(module) {
                return module.resource && module.resource.indexOf(path.resolve('./node_modules')) === 0;
              }
            })
          );
        }
      }
    }
  }

  return plugins;
};

const getDepsForNode = (builder, depPlatforms) => {
  const deps = [];
  for (const key of Object.keys(pkg.dependencies)) {
    const val = depPlatforms[key];
    if (
      key.indexOf('@types') !== 0 &&
      (!val || (val.constructor === Array && val.indexOf(builder.parent.name) >= 0) || val === builder.parent.name)
    ) {
      deps.push(key);
    }
  }
  return deps;
};

let curWebpackDevPort = 3000;
const webpackPortMap = {};

const createConfig = (builder: Builder, spin: Spin) => {
  const stack = builder.stack;

  const backendUrl = builder.backendUrl.replace('{ip}', ip.address());

  const baseConfig: any = {
    name: builder.name,
    devtool: spin.dev ? '#cheap-module-source-map' : '#source-map',
    module: {
      rules: []
    },
    resolve: {
      modules: [path.join(process.cwd(), 'node_modules'), 'node_modules']
    },
    watchOptions: {
      ignored: /build/
    },
    bail: !spin.dev
  };

  const baseDevServerConfig = {
    hot: true,
    publicPath: '/',
    headers: { 'Access-Control-Allow-Origin': '*' },
    quiet: false,
    noInfo: true,
    historyApiFallback: true,
    stats: { colors: true, chunkModules: false }
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
        if (request.indexOf('webpack') < 0 && !request.startsWith('.') && requireModule.probe(request, context)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      }
    };
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
    const name = `vendor_${builder.parent.name}`;
    config = {
      ...config,
      devtool: '#cheap-module-source-map',
      entry: {
        vendor: getDepsForNode(builder, spin.depPlatforms)
      },
      output: {
        filename: `${name}.[hash]_dll.js`,
        path: path.resolve(spin.options.dllBuildDir),
        library: name
      }
    };
  } else {
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
          devtoolModuleFilenameTemplate: spin.dev ? '../../[resource-path]' : undefined,
          devtoolFallbackModuleFilenameTemplate: spin.dev ? '../../[resource-path];[hash]' : undefined,
          filename: '[name].js',
          sourceMapFilename: '[name].[chunkhash].js.map',
          path: path.resolve(spin.options.backendBuildDir),
          publicPath: '/'
        }
      };
    } else if (stack.hasAny('web')) {
      const { protocol, host } = url.parse(backendUrl);
      const backendBaseUrl = protocol + '//' + host;
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
          filename: '[name].[hash].js',
          path: path.resolve(path.join(spin.options.frontendBuildDir, 'web')),
          publicPath: '/'
        },
        devServer: {
          ...baseDevServerConfig,
          port: webpackDevPort
        }
      };
      if (spin.options.devProxy || builder.devProxy) {
        config.devServer.proxy = {
          '!/*.hot-update.{json,js}': {
            target: backendBaseUrl,
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
          filename: `index.mobile.bundle`,
          publicPath: '/',
          path: path.resolve(path.join(spin.options.frontendBuildDir, builder.name))
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
