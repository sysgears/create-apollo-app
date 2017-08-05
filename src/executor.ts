import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as minilog from 'minilog';
import * as crypto from 'crypto';
import * as mkdirp from 'mkdirp';
import { spawn } from 'child_process';
import * as _ from 'lodash';
import * as ip from 'ip';
import * as url from 'url';
import { fromStringWithSourceMap, SourceListMap } from 'source-list-map';
import { RawSource } from 'webpack-sources';

import * as VirtualModules from 'webpack-virtual-modules';

import { Platform } from "./generator";
import requireModule from './requireModule';
import liveReloadMiddleware from './react-native/liveReloadMiddleware';

const expoPorts = {};

minilog.enable();

process.on('uncaughtException', (ex) => {
    console.error(ex);
});

process.on('unhandledRejection', reason => {
    console.error(reason);
});

const __WINDOWS__ = /^win/.test(process.platform);

let server;
let startBackend = false;
let backendFirstStart = true;

process.on('exit', () => {
    if (server) {
        server.kill('SIGTERM');
    }
});

function runServer(path, logger) {
    if (startBackend) {
        startBackend = false;
        logger('Starting backend');
        server = spawn('node', [path], {stdio: [0, 1, 2]});
        server.on('exit', code => {
            if (code === 250) {
                // App requested full reload
                startBackend = true;
            }
            logger('Backend has been stopped');
            server = undefined;
            runServer(path, logger);
        });
    }
}

function webpackReporter(watch, outputPath, log, err?, stats?) {
    if (err) {
        log(err.stack);
        throw new Error("Build error");
    }
    if (stats) {
        log(stats.toString({
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
        }));

        if (!watch) {
            mkdirp.sync(outputPath);
            fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats.toJson()));
        }
    }
}

let frontendVirtualModules = new VirtualModules({ 'node_modules/backend_reload.js': '' });

class MobileAssetsPlugin {
    vendorAssets: any;

    constructor(vendorAssets?) {
        this.vendorAssets = vendorAssets || [];
    }

    apply(compiler) {
        const self = this;
        compiler.plugin('after-compile', (compilation, callback) => {
            _.each(compilation.chunks, chunk => {
                _.each(chunk.files, file => {
                    if (file.endsWith('.bundle')) {
                        let assets = self.vendorAssets;
                        compilation.modules.forEach(function (module) {
                            if (module._asset) {
                                assets.push(module._asset);
                            }
                        });
                        compilation.assets[file.replace(".bundle", "") + ".assets"] = new RawSource(JSON.stringify(assets));
                    }
                });
            });
            callback();
        });
    }
}

function startClientWebpack(hasBackend, watch, platform, config, dll, options) {
    const webpack = requireModule('webpack');
    const logger = minilog(`webpack-for-${config.name}`);
    logger.log("We are here!");
    try {
        const reporter = (...args) => webpackReporter(watch, config.output.path, logger, ...args);

        config.plugins.push(frontendVirtualModules);

        if (watch) {
            if (config.devServer.hot) {
                _.each(config.entry, entry => {
                    if (options.reactHotLoader) {
                        entry.unshift('react-hot-loader/patch');
                    }
                    entry.unshift(
                        `webpack-hot-middleware/client`);
                });
                config.plugins.push(new webpack.HotModuleReplacementPlugin());
            }
            config.plugins.push(new webpack.NoEmitOnErrorsPlugin());
            startWebpackDevServer(hasBackend, platform, config, dll, options, reporter, logger);
        } else {
            if (platform !== 'web') {
                config.plugins.push(new MobileAssetsPlugin());
            }

            const compiler = webpack(config);

            compiler.run(reporter);
        }
    } catch (err) {
        logger(err.message, err.stack);
    }
}

let backendReloadCount = 0;
function increaseBackendReloadCount() {
  backendReloadCount++;
  frontendVirtualModules.writeModule('node_modules/backend_reload.js',
    `var count = ${backendReloadCount};\n`);
}

function startServerWebpack(watch, config, options) {
    const logger = minilog(`webpack-for-${config.name}`);

    try {
        const webpack = requireModule('webpack');
        const reporter = (...args) => webpackReporter(watch, config.output.path, logger, ...args);

        if (watch) {
            _.each(config.entry, entry => {
                if (__WINDOWS__) {
                    entry.push('webpack/hot/poll?1000');
                } else {
                    entry.push('webpack/hot/signal.js');
                }
            });
            config.plugins.push(new webpack.HotModuleReplacementPlugin(),
                new webpack.NoEmitOnErrorsPlugin());
        }

        const compiler = webpack(config);

        if (watch) {
            compiler.plugin('compilation', compilation => {
                compilation.plugin('after-optimize-assets', assets => {
                    // Patch webpack-generated original source files path, by stripping hash after filename
                    const mapKey = _.findKey(assets, (v, k) => k.endsWith('.map'));
                    if (mapKey) {
                        let srcMap = JSON.parse(assets[mapKey]._value);
                        for (let idx of srcMap.sources) {
                            srcMap.sources[idx] = srcMap.sources[idx].split(';')[0];
                        }
                        assets[mapKey]._value = JSON.stringify(srcMap);
                    }
                });
            });

            compiler.watch({}, reporter);

            compiler.plugin('done', stats => {
                const {output} = config;
                startBackend = true;
                if (server) {
                    if (!__WINDOWS__) {
                        server.kill('SIGUSR2');
                    }

                    if (options.frontendRefreshOnBackendChange) {
                        for (let module of stats.compilation.modules) {
                            if (module.built && module.resource &&
                                module.resource.indexOf(path.resolve('./src/server')) === 0) {
                                // Force front-end refresh on back-end change
                                logger.debug('Force front-end current page refresh, due to change in backend at:', module.resource);
                                increaseBackendReloadCount();
                                break;
                            }
                        }
                    }
                } else {
                    runServer(path.join(output.path, 'index.js'), logger);
                }
            });
        } else {
            compiler.run(reporter);
        }
    } catch (err) {
        logger(err.message, err.stack);
    }
}

function openFrontend(config, platform) {
    const openurl = requireModule('openurl');
    try {
        if (platform === 'web') {
            openurl.open(`http://${ip.address()}:${config.devServer.port}`);
        } else if (['android', 'ios'].indexOf(platform) >= 0) {
            startExpoProject(config, platform);
        }
    } catch (e) {
        console.error(e.stack);
    }
}

function debugMiddleware(req, res, next) {
  if (['/debug', '/debug/bundles'].indexOf(req.path) >= 0) {
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end('<!doctype html><div><a href="/debug/bundles">Cached Bundles</a></div>');
  } else {
    next();
  }
}

function startWebpackDevServer(hasBackend, platform, config, dll, options, reporter, logger) {
    const webpack = requireModule('webpack');
    const connect = requireModule('connect');
    const compression = requireModule('compression');
    const mime = requireModule('mime');
    const InspectorProxy = requireModule('react-native/local-cli/server/util/inspectorProxy.js');
    const copyToClipBoardMiddleware = requireModule('react-native/local-cli/server/middleware/copyToClipBoardMiddleware');
    const cpuProfilerMiddleware = requireModule('react-native/local-cli/server/middleware/cpuProfilerMiddleware');
    const getDevToolsMiddleware = requireModule('react-native/local-cli/server/middleware/getDevToolsMiddleware');
    const heapCaptureMiddleware = requireModule('react-native/local-cli/server/middleware/heapCaptureMiddleware.js');
    const indexPageMiddleware = requireModule('react-native/local-cli/server/middleware/indexPage');
    const loadRawBodyMiddleware = requireModule('react-native/local-cli/server/middleware/loadRawBodyMiddleware');
    const messageSocket = requireModule('react-native/local-cli/server/util/messageSocket.js');
    const openStackFrameInEditorMiddleware = requireModule('react-native/local-cli/server/middleware/openStackFrameInEditorMiddleware');
    const statusPageMiddleware = requireModule('react-native/local-cli/server/middleware/statusPageMiddleware.js');
    const systraceProfileMiddleware = requireModule('react-native/local-cli/server/middleware/systraceProfileMiddleware.js');
    const unless = requireModule('react-native/local-cli/server/middleware/unless');
    const webSocketProxy = requireModule('react-native/local-cli/server/util/webSocketProxy.js');
    const symbolicateMiddleware = requireModule('haul/src/server/middleware/symbolicateMiddleware');
    const webpackDevMiddleware = requireModule('webpack-dev-middleware');
    const webpackHotMiddleware = requireModule('webpack-hot-middleware');
    const httpProxyMiddleware = requireModule('http-proxy-middleware');
    const waitOn = requireModule('wait-on');

    const configOutputPath = config.output.path;
    config.output.path = '/';

    config.plugins.push(frontendVirtualModules);

    let vendorHashesJson, vendorSourceListMap, vendorSource, vendorMap;
    if (options.webpackDll && dll) {
        const name = `vendor_${platform}`;
        const jsonPath = path.join('..', options.dllBuildDir, `${name}_dll.json`);
        config.plugins.push(new webpack.DllReferencePlugin({
            context: process.cwd(),
            manifest: require(jsonPath) // eslint-disable-line import/no-dynamic-require
        }));
        vendorHashesJson = JSON.parse(fs.readFileSync(path.join(options.dllBuildDir, `${name}_dll_hashes.json`)).toString());
        vendorSource = new RawSource(fs.readFileSync(path.join(options.dllBuildDir, vendorHashesJson.name)).toString() + "\n");
        vendorMap = new RawSource(fs.readFileSync(path.join(options.dllBuildDir, vendorHashesJson.name + ".map")).toString());
        if (platform !== 'web') {
            const vendorAssets = JSON.parse(fs.readFileSync(path.join(options.dllBuildDir, vendorHashesJson.name + ".assets")).toString());
            config.plugins.push(new MobileAssetsPlugin(vendorAssets));
        }
        vendorSourceListMap = fromStringWithSourceMap(
            vendorSource.source(),
            JSON.parse(vendorMap.source())
        );
    }

    let compiler = webpack(config);

    compiler.plugin('after-emit', (compilation, callback) => {
        if (backendFirstStart) {
            if (hasBackend) {
                logger.debug("Webpack dev server is waiting for backend to start...");
                const {host} = url.parse(options.backendUrl.replace('{ip}', ip.address()));
                waitOn({resources: [`tcp:${host}`]}, err => {
                    if (err) {
                        logger.error(err);
                        callback();
                    } else {
                        logger.debug("Backend has been started, resuming webpack dev server...");
                        backendFirstStart = false;
                        callback();
                    }
                });
            } else {
                callback();
            }
        } else {
            callback();
        }
    });
    if (options.webpackDll && dll && platform !== 'web') {
        compiler.plugin('after-compile', (compilation, callback) => {
            _.each(compilation.chunks, chunk => {
                _.each(chunk.files, file => {
                    if (file.endsWith('.bundle')) {
                        let sourceListMap = new SourceListMap();
                        sourceListMap.add(vendorSourceListMap);
                        sourceListMap.add(fromStringWithSourceMap(compilation.assets[file].source(),
                            JSON.parse(compilation.assets[file + ".map"].source())));
                        let sourceAndMap = sourceListMap.toStringWithSourceMap({file});
                        compilation.assets[file] = new RawSource(sourceAndMap.source);
                        compilation.assets[file + ".map"] = new RawSource(JSON.stringify(sourceAndMap.map));
                    }
                });
            });
            callback();
        });
    }

    if (options.webpackDll && dll && platform === 'web' && !hasBackend) {
        compiler.plugin('after-compile', (compilation, callback) => {
            compilation.assets[vendorHashesJson.name] = vendorSource;
            compilation.assets[vendorHashesJson.name + '.map'] = vendorMap;
            callback();
        });
        compiler.plugin('compilation', function (compilation) {
            compilation.plugin('html-webpack-plugin-before-html-processing', function (htmlPluginData, callback) {
                htmlPluginData.assets.js.unshift('/' + vendorHashesJson.name);
                callback(null, htmlPluginData);
            });
        });
    }

    let frontendFirstStart = true;

    compiler.plugin('done', stats => {
        const dir = configOutputPath;
        mkdirp.sync(dir);
        if (stats.compilation.assets['assets.json']) {
            const assetsMap = JSON.parse(stats.compilation.assets['assets.json'].source());
            _.each(stats.toJson().assetsByChunkName, (assets, bundle) => {
                const bundleJs = assets.constructor === Array ? assets[0] : assets;
                assetsMap[`${bundle}.js`] = bundleJs;
                if (assets.length > 1) {
                    assetsMap[`${bundle}.js.map`] = `${bundleJs}.map`;
                }
            });
            if (options.webpackDll) {
                assetsMap['vendor.js'] = vendorHashesJson.name;
            }
            fs.writeFileSync(path.join(dir, 'assets.json'), JSON.stringify(assetsMap));
        }
        if (frontendFirstStart) {
            frontendFirstStart = false;
            openFrontend(config, platform);
        }
    });

    const app = connect();

    const serverInstance: any = http.createServer(app);

    let wsProxy, ms, inspectorProxy;

    if (platform !== 'web') {
        mime.define({'application/javascript': ['bundle']});
        mime.define({'application/json': ['assets']});

        inspectorProxy = new InspectorProxy();
        const args = {
            port: config.
                devServer.port, projectRoots: [path.resolve('.')]
        };
        app
            .use(loadRawBodyMiddleware)
            .use(function (req, res, next) {
                req.path = req.url.split('?')[0];
                // console.log("req:", req.path);
                next();
            })
            .use(compression())
            .use(getDevToolsMiddleware(args, () => wsProxy && wsProxy.isChromeConnected()))
            .use(getDevToolsMiddleware(args, () => ms && ms.isChromeConnected()))
            .use(liveReloadMiddleware(compiler))
            .use(symbolicateMiddleware(compiler))
            .use(openStackFrameInEditorMiddleware(args))
            .use(copyToClipBoardMiddleware)
            .use(statusPageMiddleware)
            .use(systraceProfileMiddleware)
            .use(heapCaptureMiddleware)
            .use(cpuProfilerMiddleware)
            .use(indexPageMiddleware)
            .use(unless('/inspector', inspectorProxy.processRequest.bind(inspectorProxy)))
            .use(debugMiddleware)
            .use(function (req, res, next) {
                const platformPrefix = `/assets/${platform}/`;
                if (req.path.indexOf(platformPrefix) === 0) {
                    const origPath = path.join(path.resolve('.'), req.path.substring(platformPrefix.length));
                    const extension = path.extname(origPath);
                    const basePath = path.join(path.dirname(origPath), path.basename(origPath, extension));
                    const files = [`.${platform}`, '.native', ''].map(suffix => basePath + suffix + extension);
                    let assetExists = false;

                    for (const filePath of files) {
                        if (fs.existsSync(filePath)) {
                            assetExists = true;
                            res.writeHead(200, {"Content-Type": mime.lookup(filePath)});
                            fs.createReadStream(filePath)
                                .pipe(res);
                        }
                    }

                    if (!assetExists) {
                        logger.warn("Asset not found:", origPath);
                        res.writeHead(404, {"Content-Type": "plain"});
                        res.end("Asset: " + origPath + " not found. Tried: " + JSON.stringify(files));
                    }
                } else {
                    next();
                }
            });
    }

    app.use(webpackDevMiddleware(compiler, _.merge({}, config.devServer, {
        reporter({state, stats}) {
            if (state) {
                logger("bundle is now VALID.");
            } else {
                logger("bundle is now INVALID.");
            }
            reporter(null, stats);
        }
    })))
        .use(webpackHotMiddleware(compiler, {log: false}));

    if (config.devServer.proxy) {
        Object.keys(config.devServer.proxy).forEach(key => {
            app.use(httpProxyMiddleware(key, config.devServer.proxy[key]));
        });
    }

    logger(`Webpack ${config.name} dev server listening on http://${ip.address()}:${config.devServer.port}`);
    serverInstance.listen(config.devServer.port, function () {
        if (platform !== 'web') {
            wsProxy = webSocketProxy.attachToServer(serverInstance, '/debugger-proxy');
            ms = messageSocket.attachToServer(serverInstance, '/message');
            webSocketProxy.attachToServer(serverInstance, '/devtools');
            inspectorProxy.attachToServer(serverInstance, '/inspector');
        }
    });
    serverInstance.timeout = 0;
    serverInstance.keepAliveTimeout = 0;
}

function isDllValid(platform, config, options): boolean {
  const name = `vendor_${platform}`;
  try {
    const hashesPath = path.join(options.dllBuildDir, `${name}_dll_hashes.json`);
    if (!fs.existsSync(hashesPath)) {
      return false;
    }
    let meta = JSON.parse(fs.readFileSync(hashesPath).toString());
    if (!fs.existsSync(path.join(options.dllBuildDir, meta.name))) {
      return false;
    }
    if (!_.isEqual(meta.modules, config.entry.vendor)) {
      return false;
    }

    let json = JSON.parse(fs.readFileSync(path.join(options.dllBuildDir, `${name}_dll.json`)).toString());

    for (let filename of Object.keys(json.content)) {
      if (filename.indexOf(' ') < 0) {
        if (!fs.existsSync(filename)) {
          console.warn(`${name} DLL need to be regenerated, file: ${filename} is missing.`);
          return false;
        }
        const hash = crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex');
        if (meta.hashes[filename] !== hash) {
          console.warn(`Hash for ${name} DLL file ${filename} has changed, need to rebuild it`);
          return false;
        }
      }
    }

    return true;
  } catch (e) {
    console.warn(`Error checking vendor bundle ${name}, regenerating it...`, e);

    return false;
  }
}

function buildDll(platform, config, options) {
    const webpack = requireModule('webpack');
    return new Promise(done => {
        const name = `vendor_${platform}`;
        const logger = minilog(`webpack-for-${config.name}`);
        const reporter = (...args) => webpackReporter(true, config.output.path, logger, ...args);

        if (!isDllValid(platform, config, options)) {
            console.log(`Generating ${name} DLL bundle with modules:\n${JSON.stringify(config.entry.vendor)}`);

            mkdirp.sync(options.dllBuildDir);
            const compiler = webpack(config);

            compiler.plugin('done', stats => {
                let json = JSON.parse(fs.readFileSync(path.join(options.dllBuildDir, `${name}_dll.json`)).toString());
                const vendorKey = _.findKey(stats.compilation.assets,
                    (v, key) => key.startsWith('vendor') && key.endsWith('_dll.js'));
                let assets = [];
                stats.compilation.modules.forEach(function (module) {
                    if (module._asset) {
                        assets.push(module._asset);
                    }
                });
                fs.writeFileSync(path.join(options.dllBuildDir, `${vendorKey}.assets`), JSON.stringify(assets));

                const meta = {name: vendorKey, hashes: {}, modules: config.entry.vendor};
                for (let filename of Object.keys(json.content)) {
                    if (filename.indexOf(' ') < 0) {
                        meta.hashes[filename] = crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex');
                        fs.writeFileSync(path.join(options.dllBuildDir, `${name}_dll_hashes.json`), JSON.stringify(meta));
                    }
                }
                done();
            });

            compiler.run(reporter);
        } else {
            done();
        }
    });
}

function setupExpoDir(dir, platform) {
    const reactNativeDir = path.join(dir, 'node_modules', 'react-native');
    mkdirp.sync(path.join(reactNativeDir, 'local-cli'));
    fs.writeFileSync(path.join(reactNativeDir, 'package.json'),
        fs.readFileSync('node_modules/react-native/package.json'));
    fs.writeFileSync(path.join(reactNativeDir, 'local-cli/cli.js'), '');
    const pkg = JSON.parse(fs.readFileSync('package.json').toString());
    const origDeps = pkg.dependencies;
    pkg.dependencies = {'react-native': origDeps['react-native']};
    if (platform !== 'all') {
        pkg.name = pkg.name + '-' + platform;
    }
    pkg.main = `index.mobile`;
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    const appJson = JSON.parse(fs.readFileSync('app.json').toString());
    if (appJson.expo.icon) {
        appJson.expo.icon = path.join(path.resolve('.'), appJson.expo.icon);
    }
    fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(appJson));
    if (platform !== 'all') {
        fs.writeFileSync(path.join(dir, '.exprc'), JSON.stringify({manifestPort: expoPorts[platform]}));
    }
}

async function startExpoServer(projectRoot, packagerPort) {
    const { Config, Project, ProjectSettings } = requireModule('xdl');

    Config.validation.reactNativeVersionWarnings = false;
    Config.developerTool = 'crna';
    Config.offline = true;

    await Project.startExpoServerAsync(projectRoot);
    await ProjectSettings.setPackagerInfoAsync(projectRoot, {
        packagerPort
    });
}

async function startExpoProject(config, platform) {
    const { UrlUtils, Android, Simulator } = requireModule('xdl');
    const qr = requireModule('qrcode-terminal');

    try {
        const projectRoot = path.join(path.resolve('.'), '.expo', platform);
        setupExpoDir(projectRoot, platform);
        await startExpoServer(projectRoot, config.devServer.port);

        const address = await UrlUtils.constructManifestUrlAsync(projectRoot);
        console.log(`Expo address for ${platform}:`, address);
        console.log("To open this app on your phone scan this QR code in Expo Client (if it doesn't get started automatically)");
        qr.generate(address, code => {
            console.log(code);
        });
        if (platform === 'android') {
            const {success, error} = await Android.openProjectAsync(projectRoot);

            if (!success) {
                console.error(error.message);
            }
        } else if (platform === 'ios') {
            const localAddress = await UrlUtils.constructManifestUrlAsync(projectRoot, {
                hostType: 'localhost',
            });
            const {success, msg} = await Simulator.openUrlInSimulatorSafeAsync(localAddress);

            if (!success) {
                console.error("Failed to start Simulator: ", msg);
            }
        }
    } catch (e) {
        console.error(e.stack);
    }
}

function startWebpack(targets, watch, platform, config, dll, options) {
    if (platform === 'server') {
        startServerWebpack(watch, config, options);
    } else {
        startClientWebpack(!!targets.server, watch, platform, config, dll, options);
    }
}

async function allocateExpoPorts(expoPlatforms) {
    let startPort = 19000;
    const freeportAsync = requireModule('freeport-async');
    for (const platform of expoPlatforms) {
        const expoPort = await freeportAsync(startPort);
        expoPorts[platform] = expoPort;
        startPort = expoPort + 1;
    }
}

async function startExpoProdServer(options) {
    const connect = requireModule('connect');
    const mime = requireModule('mime');
    const compression = requireModule('compression');

    console.log(`Starting Expo prod server`);
    const packagerPort = 3030;
    const projectRoot = path.join(path.resolve('.'), '.expo', 'all');
    startExpoServer(projectRoot, packagerPort);

    const app = connect();
    app
        .use(function (req, res, next) {
            req.path = req.url.split('?')[0];
            console.log("req:", req.url);
            next();
        })
        .use(compression())
        .use(debugMiddleware)
        .use(function (req, res, next) {
            var platform = url.parse(req.url, true).query.platform;
            if (platform) {
                const filePath = path.join(options.frontendBuildDir, platform, req.path);
                if (fs.existsSync(filePath)) {
                    res.writeHead(200, {"Content-Type": mime.lookup(filePath)});
                    fs.createReadStream(filePath)
                        .pipe(res);
                } else {
                    res.writeHead(404, {"Content-Type": "application/json"});
                    res.end(`{"message": "File not found: ${filePath}"}`);
                }
            } else {
                next();
            }
        });

    const serverInstance: any = http.createServer(app);

    console.log(`Production mobile packager listening on http://${ip.address()}:${packagerPort}`);
    serverInstance.listen(packagerPort);
    serverInstance.timeout = 0;
    serverInstance.keepAliveTimeout = 0;
}

async function startExp(options) {
    const projectRoot = path.join(process.cwd(), '.expo', 'all');
    setupExpoDir(projectRoot, 'all');
    if (['ba', 'bi', 'build:android', 'build:ios'].indexOf(process.argv[3]) >= 0) {
        await startExpoProdServer(options);
    }
    const exp = spawn(path.join(process.cwd(), 'node_modules/.bin/exp'), process.argv.splice(3), {
        cwd: projectRoot,
        stdio: [0, 1, 2]
    });
    exp.on('exit', code => {
        process.exit(code);
    });
}

const execute = (cmd, config, options) => {
    console.log(`Execute '${cmd}', config: ${config}`);
    if (cmd === 'exp') {
        startExp(options);
    } else {
        let prepareExpoPromise;
        const expoPlatforms = [];
        const watch = cmd === 'watch';
        const targets = {};
        for (let preset of Object.keys(config)) {
            const platform = new Platform(preset);
            targets[platform.target] = true;
            if (platform.hasAny('ios')) {
                expoPlatforms.push('ios');
            } else if (platform.hasAny('android')) {
                expoPlatforms.push('android');
            }
        }
        if (watch && expoPlatforms.length > 0) {
            prepareExpoPromise = allocateExpoPorts(expoPlatforms);
        } else {
            prepareExpoPromise = Promise.resolve();
        }
        prepareExpoPromise.then(() => {
            for (let preset of Object.keys(config)) {
                const platform = new Platform(preset);
                if (platform.hasAny('dll'))
                    continue;
                const prepareDllPromise: PromiseLike<any> = (cmd === 'watch' && options.webpackDll && config[`${preset}-dll`]) ?
                    buildDll(platform.target, config[`${preset}-dll`], options) : Promise.resolve();
                prepareDllPromise.then(() =>
                    startWebpack(targets, watch, platform.target, config[preset], config[`${preset}-dll`], options));
            }
        });
    }
};

export default execute;