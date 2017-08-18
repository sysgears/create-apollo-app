import * as path from 'path';
import * as ip from 'ip';
import * as url from 'url';

import requireModule from './requireModule';
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

const createBaseConfig = (node, dev, options) => {
    const platform = node.platform;
    const babelRule = {
        loader: requireModule.resolve('babel-loader'),
        options: {
            cacheDirectory: dev,
            presets: [
                requireModule.resolve('babel-preset-react'),
                [requireModule.resolve('babel-preset-es2015'), {'modules': false}],
                requireModule.resolve('babel-preset-stage-0')],
            plugins: [
                requireModule.resolve('babel-plugin-transform-runtime'),
                requireModule.resolve('babel-plugin-transform-decorators-legacy'),
                requireModule.resolve('babel-plugin-transform-class-properties'),
                [requireModule.resolve('babel-plugin-styled-components'), {'ssr': options.ssr}],
            ].concat(dev && options.reactHotLoader ? [requireModule.resolve('react-hot-loader/babel')] : []),
            only: ['*.js', '*.jsx'],
        },
    };

    const reactNativeRule = {
        loader: requireModule.resolve('babel-loader'),
        options: {
            cacheDirectory: dev,
            presets: [requireModule.resolve('babel-preset-react-native')],
            plugins: [
                requireModule.resolve('haul/src/utils/fixRequireIssues'),
            ],
        },
    };

    const baseConfig: any = {
        name: node.name,
        devtool: dev ? '#cheap-module-source-map' : '#source-map',
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
                            babelRule) as any,
                    ].concat(
                        options.persistGraphQL ?
                            ['persistgraphql-webpack-plugin/js-loader'] :
                            [],
                    ),
                },
                {
                    test: /\.graphqls/,
                    use: 'raw-loader',
                },
                {
                    test: /\.(graphql|gql)$/,
                    exclude: /node_modules/,
                    use: ['graphql-tag/loader'].concat(
                        options.persistGraphQL ?
                            ['persistgraphql-webpack-plugin/graphql-loader'] :
                            [],
                    ),
                },
            ],
        },
        resolve: {
            extensions: platform.hasAny('server') ?
                [`.web.js`, `.web.jsx`, '.js', '.jsx'] :
                [`.${platform.target}.js`, `.${platform.target}.jsx`, '.native.js', '.native.jsx', '.js', '.jsx'],
            modules: [path.join(process.cwd(), 'node_modules'), 'node_modules'],
        },
        watchOptions: {
            ignored: /build/,
        },
        bail: !dev,
    };

    if (platform.hasAny(['web', 'server'])) {
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
    } else if (platform.hasAny(['android', 'ios'])) {
        baseConfig.module.rules = baseConfig.module.rules.concat([
            {
                test: mobileAssetTest,
                use: {
                    loader: require.resolve('./react-native/assetLoader'),
                    query: {platform: platform.target, root: path.resolve('.'), bundle: false},
                },
            },
        ]);
    }
    return baseConfig;
};

let persistPlugins;
let ExtractTextPlugin;

const createPlugins = (node, nodes: Object, dev, options) => {
    const platform = node.platform;
    const webpack = requireModule('webpack');
    const buildNodeEnv = dev ? (platform.hasAny('test') ? 'test' : 'development') : 'production';

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

    if (dev) {
        plugins.push(new webpack.NamedModulesPlugin());
    } else {
        plugins.push(new webpack.optimize.UglifyJsPlugin({ minimize: true }));
        plugins.push(new webpack.LoaderOptionsPlugin({ minimize: true }));
        plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
    }

    const backendUrl = options.backendUrl.replace('{ip}', ip.address());

    if (platform.hasAny('server')) {
        plugins = plugins.concat([
            new webpack.BannerPlugin({
                banner: 'require("source-map-support").install();',
                raw: true, entryOnly: false,
            }),
            new webpack.DefinePlugin({
                __CLIENT__: false, __SERVER__: true, __SSR__: options.ssr,
                __DEV__: dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __PERSIST_GQL__: options.persistGraphQL,
                __BACKEND_URL__: `"${backendUrl}"`,
            }),
            persistPlugins.server,
        ]);
    } else {
        plugins = plugins.concat([
            new webpack.DefinePlugin({
                __CLIENT__: true, __SERVER__: false, __SSR__: options.ssr,
                __DEV__: dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
                __PERSIST_GQL__: options.persistGraphQL,
                __BACKEND_URL__: (
                    platform.target !== 'web' ||
                    url.parse(backendUrl).hostname !== 'localhost'
                ) ? `"${backendUrl}"` : false,
            }),
            persistPlugins.client,
        ]);

        if (platform.hasAny('web')) {
            const ManifestPlugin = requireModule('webpack-manifest-plugin');
            plugins.push(new ManifestPlugin({
                fileName: 'assets.json',
            }));
            let hasServer = false;
            for (let name in nodes) {
                if (nodes[name].platform.hasAny('server')) {
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

            if (!dev) {
                ExtractTextPlugin = requireModule('extract-text-webpack-plugin');
                plugins.push(new ExtractTextPlugin({filename: '[name].[contenthash].css', allChunks: true}));
                plugins.push(new webpack.optimize.CommonsChunkPlugin({
                    name: 'vendor',
                    filename: '[name].[hash].js',
                    minChunks: function (module) {
                        return module.resource && module.resource.indexOf(path.resolve('./node_modules')) === 0;
                    },
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
        const name = `vendor_${node.parentName}`;
        plugins = [
            new webpack.DefinePlugin({
                __DEV__: dev, 'process.env.NODE_ENV': `"${buildNodeEnv}"`,
            }),
            new webpack.DllPlugin({
                name,
                path: path.join(options.dllBuildDir, `${name}_dll.json`),
            }),
        ];
    }
    return plugins;
};

const getDepsForNode = (node, depPlatforms) => {
    let deps = [];
    for (let key of Object.keys(pkg.dependencies)) {
        const val = depPlatforms[key];
        if (!val || (val.constructor === Array && val.indexOf(node.parentName) >= 0) || val === node.parentName) {
            deps.push(key);
        }
    }
    if (node.platform.hasAny(['android', 'ios'])) {
        deps = deps.concat(require.resolve('./react-native/react-native-polyfill.js'));
    }
    return deps;
};

const createCssPreprocessorRules = (dev, platform): Array<Object> => {
    let createRule;

    if (platform.hasAny('server')) {
        createRule = (prep, ext) => ({
            test: new RegExp(`\.${ext}$`),
            use: dev ? [
                {loader: 'isomorphic-style-loader'},
                {loader: 'css-loader', options: {sourceMap: true}},
                {loader: 'postcss-loader', options: {sourceMap: true}},
                {loader: `${prep}-loader`, options: {sourceMap: true}}] :
                [{loader: 'ignore-loader'}],
        });
    } else if (platform.hasAny('web')) {
        createRule = (prep, ext) => ({
            test: new RegExp(`\.${ext}$`),
            use: dev ? [
                {loader: 'style-loader'},
                {loader: 'css-loader', options: {sourceMap: true, importLoaders: 1}},
                {loader: 'postcss-loader', options: {sourceMap: true}},
                {loader: `${prep}-loader`, options: {sourceMap: true}},
            ] : ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: ['css-loader', 'postcss-loader', `${prep}-loader`],
            }),
        });
    }

    const rules = [];

    if (createRule && platform.hasAny('sass')) {
        rules.push(createRule('sass', 'scss'));
    }

    if (createRule && platform.hasAny('less')) {
        rules.push(createRule('less', 'less'));
    }

    return rules;
};

const createConfig = (node, nodes, dev, opts, depPlatforms?) => {
    const platform = node.platform;

    const options: any = {...opts};

    if (platform.hasAny('test')) {
        options.ssr = false;
        options.persistGraphQL = false;
    }

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

    if (platform.hasAny(['ios', 'android'])) {
        useBabel();
    }

    const plugins = createPlugins(node, nodes, dev, options);
    if (platform.hasAny('server')) {
        const nodeExternals = requireModule('webpack-node-externals');
        const nodeExternalsFn = nodeExternals({
            whitelist: [/(^webpack|^react-native)/],
        });
        config = {
            ...createBaseConfig(node, dev, options),
            entry: {
                index: [
                    'babel-polyfill',
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
                devtoolModuleFilenameTemplate: dev ? '../../[resource-path]' : undefined,
                devtoolFallbackModuleFilenameTemplate: dev ? '../../[resource-path];[hash]' : undefined,
                filename: '[name].js',
                sourceMapFilename: '[name].[chunkhash].js.map',
                path: path.resolve(options.backendBuildDir),
                publicPath: '/',
            },
            plugins,
        };
    } else if (platform.hasAny('web')) {
        const backendUrl = options.backendUrl.replace('{ip}', ip.address());
        const { protocol, host } = url.parse(backendUrl);
        const backendBaseUrl = protocol + '//' + host;

        config = {
            ...createBaseConfig(node, dev, options),
            entry: {
                index: [
                    'babel-polyfill',
                    './src/client/index.jsx',
                ],
            },
            output: {
                filename: '[name].[hash].js',
                path: path.resolve(path.join(options.frontendBuildDir, 'web')),
                publicPath: '/',
            },
            plugins,
            devServer: {
                ...baseDevServerConfig,
                port: options.webpackDevPort,
                proxy: {
                    '!/*.hot-update.{json,js}': {
                        target: backendBaseUrl,
                        logLevel: 'info',
                    },
                },
            },
        };
    } else if (platform.hasAny(['android', 'ios'])) {
        const AssetResolver = requireModule('haul/src/resolvers/AssetResolver');
        const HasteResolver = requireModule('haul/src/resolvers/HasteResolver');
        config = {
            ...createBaseConfig(node, dev, options),
            entry: {
                index: [
                    require.resolve('./react-native/react-native-polyfill.js'),
                    './src/mobile/index.js',
                ],
            },
            output: {
                filename: `index.mobile.bundle`,
                publicPath: '/',
                path: path.resolve(path.join(options.frontendBuildDir, node.name)),
            },
            devServer: {
                ...baseDevServerConfig,
                hot: false,
                port: platform.hasAny('android') ? 3010 : 3020,
            },
            plugins,
        };
        config.resolve.plugins = [
            new HasteResolver({
                directories: [path.resolve('node_modules/react-native')],
            }),
            new AssetResolver({platform: platform.target, test: mobileAssetTest}),
        ];
        config.resolve.mainFields = ['react-native', 'browser', 'main'];
    } else {
        throw new Error(`Unknown platform target: ${platform.target}`);
    }
    config.module.rules = config.module.rules.concat(createCssPreprocessorRules(dev, platform));

    if (platform.hasAny('dll')) {
        const name = `vendor_${node.parentName}`;
        config = {
            ...config,
            devtool: '#cheap-module-source-map',
            entry: {
                vendor: getDepsForNode(node, depPlatforms),
            },
            output: {
                filename: `${name}.[hash]_dll.js`,
                path: path.resolve(options.dllBuildDir),
                library: name,
            },
        };
    }

    return config;
};

export default createConfig;
