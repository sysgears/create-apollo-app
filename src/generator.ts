import * as path from 'path';
import * as ip from 'ip';
import * as url from 'url';

import requireModule from './requireModule';
import { Builder } from "./Builder";
import Spin from "./Spin";
const pkg = requireModule('./package.json');

const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf)$/;
let babelUsed = false;

const useBabel = () => {
    if (!babelUsed) {
        require('babel-register')({
            presets: ['es2015', 'flow'],
            ignore: /node_modules(?!\/(haul|react-native))/,
            retainLines: true,
            sourceMaps: 'inline',
        });
        require('babel-polyfill');

        babelUsed = true;
    }
};

const createBaseConfig = (builder, dev) => {
    const stack = builder.stack;

    const baseConfig: any = {
        name: builder.name,
        devtool: dev ? '#cheap-module-source-map' : '#source-map',
        module: {
          rules: [],
        },
        resolve: {
            extensions: stack.hasAny('server') ?
                [`.web.js`, `.web.jsx`, '.js', '.jsx'] :
                [`.${stack.platform}.js`, `.${stack.platform}.jsx`, '.native.js', '.native.jsx', '.js', '.jsx'],
            modules: [path.join(process.cwd(), 'node_modules'), 'node_modules'],
        },
        watchOptions: {
            ignored: /build/,
        },
        bail: !dev,
    };

    if (stack.hasAny(['web', 'server'])) {
        baseConfig.resolve.alias = {
            'react-native': 'react-native-web',
        };
        baseConfig.module.rules = baseConfig.module.rules.concat([
            {
                test: /\.(png|ico|jpg|xml)$/,
                use: 'url-loader?name=[hash].[ext]&limit=10000',
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: 'url-loader?name=./assets/[hash].[ext]&limit=10000',
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: 'file-loader?name=./assets/[hash].[ext]',
            },
        ]);
    } else if (stack.hasAny('react-native')) {
        baseConfig.module.rules = baseConfig.module.rules.concat([
            {
                test: mobileAssetTest,
                use: {
                    loader: require.resolve('./react-native/assetLoader'),
                    query: {platform: stack.platform, root: path.resolve('.'), bundle: false},
                },
            },
        ]);
    }
    return baseConfig;
};

const createPlugins = (builder: Builder, spin: Spin) => {
    const stack = builder.stack;
    const webpack = requireModule('webpack');
    const buildNodeEnv = spin.dev ? (stack.hasAny('test') ? 'test' : 'development') : 'production';

    let plugins = [];

    if (spin.dev) {
        plugins.push(new webpack.NamedModulesPlugin());
    } else {
        plugins.push(new webpack.optimize.UglifyJsPlugin({ minimize: true }));
        plugins.push(new webpack.LoaderOptionsPlugin({ minimize: true }));
        plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
    }

    const backendUrl = spin.options.backendUrl.replace('{ip}', ip.address());

    if (stack.hasAny('server')) {
        plugins = plugins.concat([
            new webpack.BannerPlugin({
                banner: 'require("source-map-support").install();',
                raw: true, entryOnly: false,
            }),
            new webpack.DefinePlugin({
                __CLIENT__: false, __SERVER__: true, __SSR__: spin.options.ssr && !spin.test,
                __DEV__: spin.dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __BACKEND_URL__: `"${backendUrl}"`,
            }),
        ]);
    } else {
        plugins = plugins.concat([
            new webpack.DefinePlugin({
                __CLIENT__: true, __SERVER__: false, __SSR__: spin.options.ssr && !spin.test,
                __DEV__: spin.dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __BACKEND_URL__: (
                    stack.platform !== 'web' ||
                    url.parse(backendUrl).hostname !== 'localhost'
                ) ? `"${backendUrl}"` : false,
            }),
        ]);

        if (stack.hasAny('web')) {
            const ManifestPlugin = requireModule('webpack-manifest-plugin');
            plugins.push(new ManifestPlugin({
                fileName: 'assets.json',
            }));
            let hasServer = false;
            for (let name in spin.builders) {
                if (spin.builders[name].stack.hasAny('server')) {
                    hasServer = true;
                    break;
                }
            }
            if (!hasServer) {
                const HtmlWebpackPlugin = requireModule('html-webpack-plugin');
                plugins.push(new HtmlWebpackPlugin({
                    template: 'tools/html-plugin-template.ejs',
                    inject: 'body',
                }));
            }

            if (!spin.dev) {
                plugins.push(new webpack.optimize.CommonsChunkPlugin({
                    name: 'vendor',
                    filename: '[name].[hash].js',
                    minChunks: function (module) {
                        return module.resource && module.resource.indexOf(path.resolve('./node_modules')) === 0;
                    },
                }));
            }
        } else if (stack.hasAny('react-native')) {
            plugins.push(new webpack.SourceMapDevToolPlugin({
                test: /\.(js|jsx|css|bundle)($|\?)/i,
                filename: '[file].map',
            }));
        }
    }

    if (stack.hasAny('dll')) {
        const name = `vendor_${builder.parent.name}`;
        plugins = [
            new webpack.DefinePlugin({
                __DEV__: spin.dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
            }),
            new webpack.DllPlugin({
                name,
                path: path.join(spin.options.dllBuildDir, `${name}_dll.json`),
            }),
        ];
    }
    return plugins;
};

const getDepsForNode = (builder, depPlatforms) => {
    let deps = [];
    for (let key of Object.keys(pkg.dependencies)) {
        const val = depPlatforms[key];
        if (!val || (val.constructor === Array && val.indexOf(builder.parent.name) >= 0) || val === builder.parent.name) {
            deps.push(key);
        }
    }
    if (builder.stack.hasAny('react-native')) {
        deps = deps.concat(require.resolve('./react-native/react-native-polyfill.js'));
    }
    return deps;
};

const createConfig = (builder: Builder, spin: Spin, depPlatforms?) => {
    const stack = builder.stack;

    const baseDevServerConfig = {
        hot: true,
        contentBase: '/',
        publicPath: '/',
        headers: { 'Access-Control-Allow-Origin': '*' },
        quiet: false,
        noInfo: true,
        stats: { colors: true, chunkModules: false },
    };

    let config;

    if (stack.hasAny('react-native')) {
        useBabel();
    }

    const plugins = createPlugins(builder, spin);
    if (stack.hasAny('server')) {
        const nodeExternals = requireModule('webpack-node-externals');
        const nodeExternalsFn = nodeExternals({
            whitelist: [/(^webpack|^react-native)/],
        });
        config = {
            ...createBaseConfig(builder, spin.dev),
            entry: {
                index: [
                    './src/server/index.js',
                ],
            },
            target: 'node',
            node: {
                __dirname: true,
                __filename: true,
            },
            externals(context, request, callback) {
                return nodeExternalsFn(context, request, function () {
                    if (request.indexOf('react-native') >= 0) {
                        return callback(null, 'commonjs ' + request + '-web');
                    } else {
                        return callback.apply(this, arguments);
                    }
                });
            },
            output: {
                devtoolModuleFilenameTemplate: spin.dev ? '../../[resource-path]' : undefined,
                devtoolFallbackModuleFilenameTemplate: spin.dev ? '../../[resource-path];[hash]' : undefined,
                filename: '[name].js',
                sourceMapFilename: '[name].[chunkhash].js.map',
                path: path.resolve(spin.options.backendBuildDir),
                publicPath: '/',
            },
            plugins,
        };
    } else if (stack.hasAny('web')) {
        const backendUrl = spin.options.backendUrl.replace('{ip}', ip.address());
        const { protocol, host } = url.parse(backendUrl);
        const backendBaseUrl = protocol + '//' + host;

        config = {
            ...createBaseConfig(builder, spin.dev),
            entry: {
                index: [
                    './src/client/index.jsx',
                ],
            },
            output: {
                filename: '[name].[hash].js',
                path: path.resolve(path.join(spin.options.frontendBuildDir, 'web')),
                publicPath: '/',
            },
            plugins,
            devServer: {
                ...baseDevServerConfig,
                port: spin.options.webpackDevPort,
                proxy: {
                    '!/*.hot-update.{json,js}': {
                        target: backendBaseUrl,
                        logLevel: 'info',
                    },
                },
            },
        };
    } else if (stack.hasAny('react-native')) {
        const AssetResolver = requireModule('haul/src/resolvers/AssetResolver');
        const HasteResolver = requireModule('haul/src/resolvers/HasteResolver');
        config = {
            ...createBaseConfig(builder, spin.dev),
            entry: {
                index: [
                    './src/mobile/index.js',
                ],
            },
            output: {
                filename: `index.mobile.bundle`,
                publicPath: '/',
                path: path.resolve(path.join(spin.options.frontendBuildDir, builder.name)),
            },
            devServer: {
                ...baseDevServerConfig,
                hot: false,
                port: stack.hasAny('android') ? 3010 : 3020,
            },
            plugins,
        };
        config.resolve.plugins = [
            new HasteResolver({
                directories: [path.resolve('node_modules/react-native')],
            }),
            new AssetResolver({platform: stack.platform, test: mobileAssetTest}),
        ];
        config.resolve.mainFields = ['react-native', 'browser', 'main'];
    } else {
        throw new Error(`Unknown platform target: ${stack.platform}`);
    }

    if (stack.hasAny('dll')) {
        const name = `vendor_${builder.parent.name}`;
        config = {
            ...config,
            devtool: '#cheap-module-source-map',
            entry: {
                vendor: getDepsForNode(builder, depPlatforms),
            },
            output: {
                filename: `${name}.[hash]_dll.js`,
                path: path.resolve(spin.options.dllBuildDir),
                library: name,
            },
        };
    }

    return config;
};

export default createConfig;
