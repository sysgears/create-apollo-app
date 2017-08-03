import * as path from 'path';

import requireModule from './requireModule';
const pkg = requireModule('./package.json');
const spinConfig = pkg.spin;

const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf)$/;

class Platform {
    features: string[];
    target: string;

    constructor(preset) {
        this.features = preset.split('-');
        if (this.hasAny('server')) {
            this.target = 'server';
        } else if (this.hasAny('web')) {
            this.target = 'web';
        } else if (this.hasAny('android')) {
            this.target = 'android'
        } else if (this.hasAny('ios')) {
            this.target = 'ios';
        }
    }

    hasAny(arg): Boolean {
        const array = arg.constructor === Array ? arg : [arg];
        for (let feature of array) {
            if (this.features.indexOf(feature) >= 0) {
                return true;
            }
        }
        return false;
    }
}

const createBaseConfig = (platform: Platform, watch, options) => {
    const babelRule = {
        loader: 'babel-loader',
        options: {
            cacheDirectory: watch,
            presets: ["react", ["es2015", {"modules": false}], "stage-0"],
            plugins: [
                "transform-runtime",
                "transform-decorators-legacy",
                "transform-class-properties",
                ["styled-components", {"ssr": options.ssr}]
            ].concat(watch && options.reactHotLoader ? ['react-hot-loader/babel'] : []),
            only: ["*.js", "*.jsx"]
        }
    };

    const reactNativeRule = {
        loader: 'babel-loader',
        options: {
            cacheDirectory: watch,
            presets: ["react-native"],
            plugins: [
                path.join(process.cwd(), 'node_modules/haul/src/utils/fixRequireIssues')
            ]
        }
    };

    const baseConfig: any = {
        devtool: watch ? '#cheap-module-source-map' : '#source-map',
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    exclude: platform.hasAny(['ios', 'android']) ?
                        /node_modules\/(?!react-native|@expo|expo|lottie-react-native|haul|pretty-format|react-navigation)$/ :
                        /node_modules/,
                    use: [
                        (platform.hasAny(['ios', 'android']) ?
                            function (req) {
                                let result;
                                if (req.resource.indexOf('node_modules') >= 0) {
                                    result = reactNativeRule;
                                } else {
                                    result = babelRule;
                                }
                                return result;
                            } :
                            babelRule) as any
                    ].concat(
                        options.persistGraphQL ?
                            ['persistgraphql-webpack-plugin/js-loader'] :
                            []
                    )
                },
                {
                    test: /\.graphqls/,
                    use: 'raw-loader'
                },
                {
                    test: /\.(graphql|gql)$/,
                    exclude: /node_modules/,
                    use: ['graphql-tag/loader'].concat(
                        options.persistGraphQL ?
                            ['persistgraphql-webpack-plugin/graphql-loader'] :
                            []
                    )
                },
            ]
        },
        resolve: {
            extensions: platform.hasAny('server') ?
                [`.web.js`, `.web.jsx`, '.js', '.jsx'] :
                [`.${platform.target}.js`, `.${platform.target}.jsx`, '.native.js', '.native.jsx', '.js', '.jsx']
        },
        watchOptions: {
            ignored: /build/
        },
        bail: !watch
    };

    if (platform.hasAny(['web', 'server'])) {
        baseConfig.resolve.alias = {
            'react-native': 'react-native-web'
        };
        baseConfig.module.rules = baseConfig.module.rules.concat([
            {
                test: /\.(png|ico|jpg|xml)$/,
                use: 'url-loader?name=[hash].[ext]&limit=10000'
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: 'url-loader?name=./assets/[hash].[ext]&limit=10000'
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: 'file-loader?name=./assets/[hash].[ext]'
            },
        ]);
    } else if (platform.hasAny(['android', 'ios'])) {
        baseConfig.module.rules = baseConfig.module.rules.concat([
            {
                test: mobileAssetTest,
                use: {
                    loader: require.resolve('./react-native/assetLoader'),
                    query: {platform: platform.target, root: path.resolve('.'), bundle: false},
                }
            }
        ]);
    }
    return baseConfig;
};

let persistPlugins;
let ExtractTextPlugin;

const createPlugins = (platform: Platform, watch, options) => {
    const webpack = requireModule('webpack');
    const buildNodeEnv = watch ? (platform.hasAny('test') ? 'test' : 'development') : 'production';

    if (!persistPlugins) {
        const PersistGraphQLPlugin = requireModule('persistgraphql-webpack-plugin');
        const moduleName = path.resolve('node_modules/persisted_queries.json');
        if (options.persistGraphQL) {
            const clientPersistPlugin = new PersistGraphQLPlugin({ moduleName,
                filename: 'extracted_queries.json', addTypename: true });
            const serverPersistPlugin = new PersistGraphQLPlugin({ moduleName,
                provider: clientPersistPlugin });
            persistPlugins = { client: clientPersistPlugin, server: serverPersistPlugin };
        } else {
            // Dummy plugin instances just to create persisted_queries.json virtual module
            const clientPersistPlugin = new PersistGraphQLPlugin({ moduleName });
            const serverPersistPlugin = new PersistGraphQLPlugin({ moduleName });
            persistPlugins = { client: clientPersistPlugin, server: serverPersistPlugin };
        }
    }

    let plugins = [];

    if (watch) {
        plugins.push(new webpack.NamedModulesPlugin());
    } else {
        plugins.push(new webpack.optimize.UglifyJsPlugin({ minimize: true }));
        plugins.push(new webpack.LoaderOptionsPlugin({ minimize: true }));
        plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
    }

    if (platform.hasAny('server')) {
        plugins = plugins.concat([
            new webpack.BannerPlugin({
                banner: 'require("source-map-support").install();',
                raw: true, entryOnly: false
            }),
            new webpack.DefinePlugin({
                __CLIENT__: false, __SERVER__: true, __SSR__: options.ssr,
                __DEV__: watch, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __PERSIST_GQL__: options.persistGraphQL
            }),
            persistPlugins.server
        ]);
    } else {
        plugins = plugins.concat([
            new webpack.DefinePlugin({
                __CLIENT__: true, __SERVER__: false, __SSR__: options.ssr,
                __DEV__: watch, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __PERSIST_GQL__: options.persistGraphQL
            }),
            persistPlugins.client
        ]);

        if (platform.hasAny('web')) {
            const ManifestPlugin = requireModule('webpack-manifest-plugin');
            plugins.push(new ManifestPlugin({
                fileName: 'assets.json'
            }));
            if (!spinConfig.presets['apollo-react-server']) {
                const HtmlWebpackPlugin = requireModule('html-webpack-plugin');
                plugins.push(new HtmlWebpackPlugin({
                    template: 'tools/html-plugin-template.ejs',
                    inject: 'body',
                }));
            }

            if (!watch) {
                ExtractTextPlugin = requireModule('extract-text-webpack-plugin');
                plugins.push(new ExtractTextPlugin({filename: '[name].[contenthash].css', allChunks: true}));
                plugins.push(new webpack.optimize.CommonsChunkPlugin({
                    name: "vendor",
                    filename: "[name].[hash].js",
                    minChunks: function (module) {
                        return module.resource && module.resource.indexOf(path.resolve('./node_modules')) === 0;
                    }
                }));
            }
        } else if (platform.hasAny(['android', 'ios'])) {
            plugins.push(new webpack.SourceMapDevToolPlugin({
                test: /\.(js|jsx|css|bundle)($|\?)/i,
                filename: '[file].map',
            }));
        }
    }

    if (platform.hasAny('dll')) {
        const name = `vendor_${platform.target}`;
        plugins = [
            new webpack.DefinePlugin({
                __DEV__: watch, 'process.env.NODE_ENV': `"${buildNodeEnv}"`
            }),
            new webpack.DllPlugin({
                name,
                path: path.join(options.dllBuildDir, `${name}_dll.json`),
            })
        ];
    }
    return plugins;
};

const getDepsForPlatform = (platform: Platform, depPlatforms) => {
    let deps = [];
    for (let key of Object.keys(pkg.dependencies)) {
        const val = depPlatforms[key];
        if (!val || platform.hasAny(val)) {
            deps.push(key);
        }
    }
    if (platform.hasAny(['android', 'ios'])) {
        deps = deps.concat(require.resolve('./react-native/react-native-polyfill.js'));
    }
    return deps;
};

const createConfig = (preset, watch, options, depPlatforms) => {
    const platform = new Platform(preset);

    if (platform.hasAny('test')) {
        options.ssr = false;
        options.persistGraphQL = false;
    }
    options.backendBuildDir = options.backendBuildDir || 'build/server';
    options.frontendBuildDir = options.frontendBuildDir || 'build/client';
    options.webpackDevPort = options.webpackDevPort || 3000;

    const baseDevServerConfig = {
        hot: true,
        contentBase: '/',
        publicPath: '/',
        headers: { 'Access-Control-Allow-Origin': '*' },
        quiet: false,
        noInfo: true,
        stats: { colors: true, chunkModules: false }
    };

    let config;
    const plugins = createPlugins(platform, watch, options);
    if (platform.hasAny('server')) {
        const nodeExternals = requireModule('webpack-node-externals');
        const nodeExternalsFn = nodeExternals({
            whitelist: [/(^webpack|^react-native)/]
        });
        config = {
            ...createBaseConfig(platform, watch, options),
            name: 'backend',
            target: 'node',
            node: {
                __dirname: true,
                __filename: true
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
            module: {
                rules: [
                    {
                        test: /\.scss$/,
                        use: watch ? [
                            {loader: 'isomorphic-style-loader'},
                            {loader: 'css-loader', options: {sourceMap: true}},
                            {loader: 'postcss-loader', options: {sourceMap: true}},
                            {loader: 'sass-loader', options: {sourceMap: true}}] :
                            [{loader: 'ignore-loader'}]
                    }
                ]
            },
            output: {
                devtoolModuleFilenameTemplate: watch ? '../../[resource-path]' : undefined,
                devtoolFallbackModuleFilenameTemplate: watch ? '../../[resource-path];[hash]' : undefined,
                filename: '[name].js',
                sourceMapFilename: '[name].[chunkhash].js.map',
                path: path.resolve(options.backendBuildDir),
                publicPath: '/'
            },
            plugins
        };
    } else if (platform.hasAny('web')) {
        config = {
            ...createBaseConfig(platform, watch, options),
            name: 'web-frontend',
            module: {
                rules: [
                    {
                        test: /\.scss$/,
                        use: watch ? [
                            {loader: 'style-loader'},
                            {loader: 'css-loader', options: {sourceMap: true, importLoaders: 1}},
                            {loader: 'postcss-loader', options: {sourceMap: true}},
                            {loader: 'sass-loader', options: {sourceMap: true}},
                        ] : ExtractTextPlugin.extract({
                            fallback: "style-loader",
                            use: ['css-loader', 'postcss-loader', 'sass-loader']
                        })
                    }
                ]
            },
            output: {
                filename: '[name].[hash].js',
                path: path.resolve(path.join(options.frontendBuildDir, 'web')),
                publicPath: '/'
            },
            plugins,
            devServer: {
                ...baseDevServerConfig,
                port: options.webpackDevPort
            }
        };
    } else if (platform.hasAny(['android', 'ios'])) {
        const AssetResolver = requireModule('haul/src/resolvers/AssetResolver');
        const HasteResolver = requireModule('haul/src/resolvers/HasteResolver');
        config = {
            ...createBaseConfig(platform, watch, options),
          name: `${platform.target}-frontend`,
          output: {
            filename: `index.mobile.bundle`,
            publicPath: '/',
            path: path.resolve(path.join(options.frontendBuildDir, platform.target)),
          },
          devServer: {
              ...baseDevServerConfig,
            hot: false,
            port: platform.hasAny('android') ? 3010 : 3020
          },
          resolve: {
            plugins: [
              new HasteResolver({
                directories: [path.resolve('node_modules/react-native')],
              }),
              new AssetResolver({ platform: platform.target, test: mobileAssetTest }),
            ],
            mainFields: ['react-native', 'browser', 'main']
          },
          plugins
        }
    } else {
        throw new Error(`Unknown platform target: ${platform.target}`);
    }

    if (platform.hasAny('dll')) {
        const name = `vendor_${platform.target}`;
        config = {
            ...config,
            devtool: '#cheap-module-source-map',
            name: `${platform}-dll`,
            entry: {
                vendor: getDepsForPlatform(platform, depPlatforms),
            },
            output: {
                filename: `${name}.[hash]_dll.js`,
                path: path.resolve(options.dllBuildDir),
                library: name
            },
        };
    }

    return config;
};

export default createConfig;