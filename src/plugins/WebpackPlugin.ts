import * as path from 'path';
import * as ip from 'ip';
import * as url from 'url';

import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';

const pkg = requireModule('./package.json');

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
                    template: path.resolve('html-plugin-template.ejs'),
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
    return deps;
};

const createConfig = (builder: Builder, spin: Spin) => {
    const stack = builder.stack;

    const baseConfig: any = {
        name: builder.name,
        devtool: spin.dev ? '#cheap-module-source-map' : '#source-map',
        module: {
            rules: [],
        },
        resolve: {
            modules: [path.join(process.cwd(), 'node_modules'), 'node_modules'],
        },
        watchOptions: {
            ignored: /build/,
        },
        bail: !spin.dev,
    };

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

    const plugins = createPlugins(builder, spin);
    if (stack.hasAny('server')) {
        config = {
            ...baseConfig,
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
            externals: requireModule('webpack-node-externals'),
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
            ...baseConfig,
            entry: {
                index: [
                    './src/client/index.js',
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
        config = {
            ...baseConfig,
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
    } else {
        throw new Error(`Unknown platform target: ${stack.platform}`);
    }

    if (stack.hasAny('dll')) {
        const name = `vendor_${builder.parent.name}`;
        config = {
            ...config,
            devtool: '#cheap-module-source-map',
            entry: {
                vendor: getDepsForNode(builder, spin.depPlatforms),
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

export default class WebpackPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAny('webpack')) {
            builder.config = builder.config || {};
            builder.config = spin.merge(builder.config, createConfig(builder, spin));
        }
    }
}