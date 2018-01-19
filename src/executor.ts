import { exec, spawn } from 'child_process';
import * as containerized from 'containerized';
import * as crypto from 'crypto';
import * as Debug from 'debug';
import * as detectPort from 'detect-port';
import * as fs from 'fs';
import * as http from 'http';
import * as ip from 'ip';
import * as _ from 'lodash';
import * as minilog from 'minilog';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as serveStatic from 'serve-static';
import { fromStringWithSourceMap, SourceListMap } from 'source-list-map';
import * as url from 'url';
import { RawSource } from 'webpack-sources';

import { Builder, Builders } from './Builder';
import liveReloadMiddleware from './plugins/react-native/liveReloadMiddleware';
import Spin from './Spin';

const SPIN_DLL_VERSION = 1;

const debug = Debug('spinjs');
const expoPorts = {};

const spinLogger = minilog('spin');

process.on('uncaughtException', ex => {
  spinLogger.error(ex);
});

process.on('unhandledRejection', reason => {
  spinLogger.error(reason);
});

const __WINDOWS__ = /^win/.test(process.platform);

let server;
let startBackend = false;
let nodeDebugOpt;

process.on('exit', () => {
  if (server) {
    server.kill('SIGTERM');
  }
});

const spawnServer = (serverPath, debugOpt, logger) => {
  server = spawn('node', [debugOpt, serverPath], { stdio: [0, 1, 2] });
  logger(`Spawning ${['node', debugOpt, serverPath].join(' ')}`);
  server.on('exit', code => {
    if (code === 250) {
      // App requested full reload
      startBackend = true;
    }
    logger('Backend has been stopped');
    server = undefined;
    runServer(serverPath, logger);
  });
};

const runServer = (serverPath, logger) => {
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Backend doesn't exist at ${serverPath}, exiting`);
  }
  if (startBackend) {
    startBackend = false;
    logger('Starting backend');

    if (!nodeDebugOpt) {
      exec('node -v', (error, stdout, stderr) => {
        if (error) {
          spinLogger.error(error);
          process.exit(1);
        }
        const nodeVersion = stdout.match(/^v([0-9]+)\.([0-9]+)\.([0-9]+)/);
        const nodeMajor = parseInt(nodeVersion[1], 10);
        const nodeMinor = parseInt(nodeVersion[2], 10);
        nodeDebugOpt = nodeMajor >= 6 || (nodeMajor === 6 && nodeMinor >= 9) ? '--inspect' : '--debug';
        detectPort(9229).then(debugPort => {
          spawnServer(serverPath, nodeDebugOpt + '=' + debugPort, logger);
        });
      });
    } else {
      spawnServer(serverPath, nodeDebugOpt, logger);
    }
  }
};

const webpackReporter = (spin: Spin, outputPath, log, err?, stats?) => {
  if (err) {
    log(err.stack);
    throw new Error('Build error');
  }
  if (stats) {
    log(
      stats.toString({
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
      })
    );

    if (!spin.watch) {
      mkdirp.sync(outputPath);
      fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats.toJson()));
    }
  }
};

let frontendVirtualModules;

class MobileAssetsPlugin {
  public vendorAssets: any;

  constructor(vendorAssets?) {
    this.vendorAssets = vendorAssets || [];
  }

  public apply(compiler) {
    compiler.plugin('after-compile', (compilation, callback) => {
      compilation.chunks.forEach(chunk => {
        chunk.files.forEach(file => {
          if (file.endsWith('.bundle')) {
            const assets = this.vendorAssets;
            compilation.modules.forEach(module => {
              if (module._asset) {
                assets.push(module._asset);
              }
            });
            compilation.assets[file.replace('.bundle', '') + '.assets'] = new RawSource(JSON.stringify(assets));
          }
        });
      });
      callback();
    });
  }
}

const startClientWebpack = (hasBackend, spin, builder) => {
  const webpack = spin.require('webpack');

  const config = builder.config;

  config.plugins.push(frontendVirtualModules);

  const logger = minilog(`webpack-for-${config.name}`);
  try {
    const reporter = (...args) => webpackReporter(spin, config.output.path, logger, ...args);

    if (spin.watch) {
      startWebpackDevServer(hasBackend, spin, builder, reporter, logger);
    } else {
      if (builder.stack.platform !== 'web') {
        config.plugins.push(new MobileAssetsPlugin());
      }

      const compiler = webpack(config);

      compiler.run(reporter);
    }
  } catch (err) {
    logger(err.message, err.stack);
  }
};

let backendReloadCount = 0;
const increaseBackendReloadCount = () => {
  backendReloadCount++;
  frontendVirtualModules.writeModule('node_modules/backend_reload.js', `var count = ${backendReloadCount};\n`);
};

const startServerWebpack = (spin, builder) => {
  const config = builder.config;
  const logger = minilog(`webpack-for-${config.name}`);

  try {
    const webpack = spin.require('webpack');
    const reporter = (...args) => webpackReporter(spin, config.output.path, logger, ...args);

    const compiler = webpack(config);

    if (spin.watch) {
      compiler.plugin('compilation', compilation => {
        compilation.plugin('after-optimize-assets', assets => {
          // Patch webpack-generated original source files path, by stripping hash after filename
          const mapKey = _.findKey(assets, (v, k) => k.endsWith('.map'));
          if (mapKey) {
            const srcMap = JSON.parse(assets[mapKey]._value);
            for (const idx of Object.keys(srcMap.sources)) {
              srcMap.sources[idx] = srcMap.sources[idx].split(';')[0];
            }
            assets[mapKey]._value = JSON.stringify(srcMap);
          }
        });
      });

      compiler.watch({}, reporter);

      compiler.plugin('done', stats => {
        if (!stats.compilation.errors.length) {
          const { output } = config;
          startBackend = true;
          if (server) {
            if (!__WINDOWS__) {
              server.kill('SIGUSR2');
            }

            if (builder.frontendRefreshOnBackendChange) {
              for (const module of stats.compilation.modules) {
                if (module.built && module.resource && module.resource.indexOf(path.resolve('./src/server')) === 0) {
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
        }
      });
    } else {
      compiler.run(reporter);
    }
  } catch (err) {
    logger(err.message, err.stack);
  }
};

const openFrontend = (spin, builder, logger) => {
  const openurl = spin.require('openurl');
  try {
    if (builder.stack.hasAny('web')) {
      const lanUrl = `http://${ip.address()}:${builder.config.devServer.port}`;
      const localUrl = `http://localhost:${builder.config.devServer.port}`;
      if (containerized() || builder.openBrowser === false) {
        logger.info(`App is running at, Local: ${localUrl} LAN: ${lanUrl}`);
      } else {
        openurl.open(localUrl);
      }
    } else if (builder.stack.hasAny('react-native')) {
      startExpoProject(spin, builder.config, builder.stack.platform, logger);
    }
  } catch (e) {
    logger.error(e.stack);
  }
};

const debugMiddleware = (req, res, next) => {
  if (['/debug', '/debug/bundles'].indexOf(req.path) >= 0) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><div><a href="/debug/bundles">Cached Bundles</a></div>');
  } else {
    next();
  }
};

const startWebpackDevServer = (hasBackend: boolean, spin: Spin, builder: Builder, reporter, logger) => {
  const webpack = spin.require('webpack');
  const waitOn = spin.require('wait-on');

  const config = builder.config;
  const platform = builder.stack.platform;

  const configOutputPath = config.output.path;
  config.output.path = '/';

  let vendorHashesJson;
  let vendorSourceListMap;
  let vendorSource;
  let vendorMap;

  if (builder.webpackDll && builder.child) {
    const name = `vendor_${platform}`;
    const jsonPath = path.join(builder.dllBuildDir, `${name}_dll.json`);
    config.plugins.push(
      new webpack.DllReferencePlugin({
        context: process.cwd(),
        manifest: spin.require('./' + jsonPath)
      })
    );
    vendorHashesJson = JSON.parse(
      fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll_hashes.json`)).toString()
    );
    vendorSource = new RawSource(
      fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name)).toString() + '\n'
    );
    if (platform !== 'web') {
      const vendorAssets = JSON.parse(
        fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name + '.assets')).toString()
      );
      config.plugins.push(new MobileAssetsPlugin(vendorAssets));
    }
    if (builder.sourceMap) {
      vendorMap = new RawSource(
        fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name + '.map')).toString()
      );
      vendorSourceListMap = fromStringWithSourceMap(vendorSource.source(), JSON.parse(vendorMap.source()));
    }
  }

  const compiler = webpack(config);
  let awaitedAlready = false;

  compiler.plugin('after-emit', (compilation, callback) => {
    if (!awaitedAlready) {
      if (hasBackend || builder.waitOn) {
        let waitOnUrls;
        const backendOption = builder.backendUrl || builder.backendUrl;
        if (backendOption) {
          const { protocol, hostname, port } = url.parse(backendOption.replace('{ip}', ip.address()));
          waitOnUrls = [`tcp:${hostname}:${port || (protocol === 'https:' ? 443 : 80)}`];
        } else {
          waitOnUrls = builder.waitOn ? [].concat(builder.waitOn) : undefined;
        }
        if (waitOnUrls && waitOnUrls.length) {
          logger.debug(`waiting for ${waitOnUrls}`);
          const waitStart = Date.now();
          const waitNotifier = setInterval(() => {
            logger.debug(`still waiting for ${waitOnUrls} after ${Date.now() - waitStart}ms...`);
          }, 10000);
          waitOn({ resources: waitOnUrls }, err => {
            clearInterval(waitNotifier);
            awaitedAlready = true;
            if (err) {
              logger.error(err);
            } else {
              logger.debug('Backend has been started, resuming webpack dev server...');
            }
            callback();
          });
        } else {
          awaitedAlready = true;
          callback();
        }
      } else {
        callback();
      }
    } else {
      callback();
    }
  });
  if (builder.sourceMap && builder.webpackDll && builder.child && platform !== 'web') {
    compiler.plugin('after-compile', (compilation, callback) => {
      compilation.chunks.forEach(chunk => {
        chunk.files.forEach(file => {
          if (file.endsWith('.bundle')) {
            const sourceListMap = new SourceListMap();
            sourceListMap.add(vendorSourceListMap);
            sourceListMap.add(
              fromStringWithSourceMap(
                compilation.assets[file].source(),
                JSON.parse(compilation.assets[file + '.map'].source())
              )
            );
            const sourceAndMap = sourceListMap.toStringWithSourceMap({ file });
            compilation.assets[file] = new RawSource(sourceAndMap.source);
            compilation.assets[file + '.map'] = new RawSource(JSON.stringify(sourceAndMap.map));
          }
        });
      });
      callback();
    });
  }

  if (builder.webpackDll && builder.child && platform === 'web' && !builder.ssr) {
    compiler.plugin('after-compile', (compilation, callback) => {
      compilation.assets[vendorHashesJson.name] = vendorSource;
      if (builder.sourceMap) {
        compilation.assets[vendorHashesJson.name + '.map'] = vendorMap;
      }
      callback();
    });
    compiler.plugin('compilation', compilation => {
      compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
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
      if (builder.webpackDll) {
        assetsMap['vendor.js'] = vendorHashesJson.name;
      }
      fs.writeFileSync(path.join(dir, 'assets.json'), JSON.stringify(assetsMap));
    }
    if (frontendFirstStart) {
      frontendFirstStart = false;
      openFrontend(spin, builder, logger);
    }
  });

  let serverInstance: any;

  let webSocketProxy;
  let messageSocket;
  let wsProxy;
  let ms;
  let inspectorProxy;

  if (platform === 'web') {
    const WebpackDevServer = spin.require('webpack-dev-server');

    serverInstance = new WebpackDevServer(compiler, {
      ...config.devServer,
      reporter: ({ state, stats }) => {
        if (state) {
          logger('bundle is now VALID.');
        } else {
          logger('bundle is now INVALID.');
        }
        reporter(null, stats);
      }
    });
  } else {
    const connect = spin.require('connect');
    const compression = spin.require('compression');
    const httpProxyMiddleware = spin.require('http-proxy-middleware');
    const mime = spin.require('mime', spin.require.resolve('webpack-dev-middleware'));
    const webpackDevMiddleware = spin.require('webpack-dev-middleware');
    const webpackHotMiddleware = spin.require('webpack-hot-middleware');

    const app = connect();

    serverInstance = http.createServer(app);
    mime.define({ 'application/javascript': ['bundle'] }, true);
    mime.define({ 'application/json': ['assets'] }, true);

    messageSocket = spin.require('react-native/local-cli/server/util/messageSocket.js');
    webSocketProxy = spin.require('react-native/local-cli/server/util/webSocketProxy.js');

    try {
      const InspectorProxy = spin.require('react-native/local-cli/server/util/inspectorProxy.js');
      inspectorProxy = new InspectorProxy();
    } catch (ignored) {}
    const copyToClipBoardMiddleware = spin.require(
      'react-native/local-cli/server/middleware/copyToClipBoardMiddleware'
    );
    let cpuProfilerMiddleware;
    try {
      cpuProfilerMiddleware = spin.require('react-native/local-cli/server/middleware/cpuProfilerMiddleware');
    } catch (ignored) {}
    const getDevToolsMiddleware = spin.require('react-native/local-cli/server/middleware/getDevToolsMiddleware');
    let heapCaptureMiddleware;
    try {
      heapCaptureMiddleware = spin.require('react-native/local-cli/server/middleware/heapCaptureMiddleware.js');
    } catch (ignored) {}
    const indexPageMiddleware = spin.require('react-native/local-cli/server/middleware/indexPage');
    const loadRawBodyMiddleware = spin.require('react-native/local-cli/server/middleware/loadRawBodyMiddleware');
    const openStackFrameInEditorMiddleware = spin.require(
      'react-native/local-cli/server/middleware/openStackFrameInEditorMiddleware'
    );
    const statusPageMiddleware = spin.require('react-native/local-cli/server/middleware/statusPageMiddleware.js');
    const systraceProfileMiddleware = spin.require(
      'react-native/local-cli/server/middleware/systraceProfileMiddleware.js'
    );
    const unless = spin.require('react-native/local-cli/server/middleware/unless');
    const symbolicateMiddleware = spin.require('haul/src/server/middleware/symbolicateMiddleware');

    const args = {
      port: config.devServer.port,
      projectRoots: [path.resolve('.')]
    };
    app
      .use(loadRawBodyMiddleware)
      .use((req, res, next) => {
        req.path = req.url.split('?')[0];
        debug(`Dev mobile packager request: ${req.path}`);
        next();
      })
      .use(compression())
      .use(
        '/debugger-ui',
        serveStatic(
          path.join(
            path.dirname(spin.require.resolve('react-native/package.json')),
            '/local-cli/server/util/debugger-ui'
          )
        )
      )
      .use(getDevToolsMiddleware(args, () => wsProxy && wsProxy.isChromeConnected()))
      .use(getDevToolsMiddleware(args, () => ms && ms.isChromeConnected()))
      .use(liveReloadMiddleware(compiler))
      .use(symbolicateMiddleware(compiler))
      .use(openStackFrameInEditorMiddleware(args))
      .use(copyToClipBoardMiddleware)
      .use(statusPageMiddleware)
      .use(systraceProfileMiddleware)
      .use(indexPageMiddleware)
      .use(debugMiddleware)
      .use((req, res, next) => {
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
              res.writeHead(200, { 'Content-Type': mime.lookup ? mime.lookup(filePath) : mime.getType(filePath) });
              fs.createReadStream(filePath).pipe(res);
            }
          }

          if (!assetExists) {
            logger.warn('Asset not found:', origPath);
            res.writeHead(404, { 'Content-Type': 'plain' });
            res.end('Asset: ' + origPath + ' not found. Tried: ' + JSON.stringify(files));
          }
        } else {
          next();
        }
      });
    if (heapCaptureMiddleware) {
      app.use(heapCaptureMiddleware);
    }
    if (cpuProfilerMiddleware) {
      app.use(cpuProfilerMiddleware);
    }
    if (inspectorProxy) {
      app.use(unless('/inspector', inspectorProxy.processRequest.bind(inspectorProxy)));
    }
    const devMiddleware = webpackDevMiddleware(
      compiler,
      _.merge({}, config.devServer, {
        reporter(mwOpts, { state, stats }) {
          if (state) {
            logger('bundle is now VALID.');
          } else {
            logger('bundle is now INVALID.');
          }
          reporter(null, stats);
        }
      })
    );

    app
      .use((req, res, next) => {
        if (platform !== 'web') {
          // Workaround for Expo Client bug in parsing Content-Type header with charset
          const origSetHeader = res.setHeader;
          res.setHeader = (key, value) => {
            let val = value;
            if (key === 'Content-Type' && value.indexOf('application/javascript') >= 0) {
              val = value.split(';')[0];
            }
            origSetHeader.call(res, key, val);
          };
        }
        return devMiddleware(req, res, next);
      })
      .use(webpackHotMiddleware(compiler, { log: false }));

    if (config.devServer.proxy) {
      Object.keys(config.devServer.proxy).forEach(key => {
        app.use(httpProxyMiddleware(key, config.devServer.proxy[key]));
      });
    }
  }

  logger(`Webpack ${config.name} dev server listening on http://localhost:${config.devServer.port}`);
  serverInstance.listen(config.devServer.port, () => {
    if (platform !== 'web') {
      wsProxy = webSocketProxy.attachToServer(serverInstance, '/debugger-proxy');
      ms = messageSocket.attachToServer(serverInstance, '/message');
      webSocketProxy.attachToServer(serverInstance, '/devtools');
      if (inspectorProxy) {
        inspectorProxy.attachToServer(serverInstance, '/inspector');
      }
    }
  });
  serverInstance.timeout = 0;
  serverInstance.keepAliveTimeout = 0;
};

const isDllValid = (platform, config, builder, logger): boolean => {
  const name = `vendor_${platform}`;
  try {
    const hashesPath = path.join(builder.dllBuildDir, `${name}_dll_hashes.json`);
    if (!fs.existsSync(hashesPath)) {
      return false;
    }
    const meta = JSON.parse(fs.readFileSync(hashesPath).toString());
    if (SPIN_DLL_VERSION !== meta.version) {
      return false;
    }
    if (!fs.existsSync(path.join(builder.dllBuildDir, meta.name))) {
      return false;
    }
    if (builder.sourceMap && !fs.existsSync(path.join(builder.dllBuildDir, meta.name + '.map'))) {
      return false;
    }
    if (!_.isEqual(meta.modules, config.entry.vendor)) {
      return false;
    }

    const json = JSON.parse(fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`)).toString());

    for (const filename of Object.keys(json.content)) {
      if (filename.indexOf(' ') < 0) {
        if (!fs.existsSync(filename)) {
          logger.warn(`${name} DLL need to be regenerated, file: ${filename} is missing.`);
          return false;
        }
        const hash = crypto
          .createHash('md5')
          .update(fs.readFileSync(filename))
          .digest('hex');
        if (meta.hashes[filename] !== hash) {
          logger.warn(`Hash for ${name} DLL file ${filename} has changed, need to rebuild it`);
          return false;
        }
      }
    }

    return true;
  } catch (e) {
    logger.warn(`Error checking vendor bundle ${name}, regenerating it...`, e);

    return false;
  }
};

const buildDll = (platform, config, builder: Builder, spin: Spin) => {
  const webpack = spin.require('webpack');
  return new Promise(done => {
    const name = `vendor_${platform}`;
    const logger = minilog(`webpack-for-${config.name}`);
    const reporter = (...args) => webpackReporter(spin, config.output.path, logger, ...args);

    if (!isDllValid(platform, config, builder, logger)) {
      logger.info(`Generating ${name} DLL bundle with modules:\n${JSON.stringify(config.entry.vendor)}`);

      mkdirp.sync(builder.dllBuildDir);
      const compiler = webpack(config);

      compiler.plugin('done', stats => {
        try {
          const json = JSON.parse(fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`)).toString());
          const vendorKey = _.findKey(
            stats.compilation.assets,
            (v, key) => key.startsWith('vendor') && key.endsWith('_dll.js')
          );
          const assets = [];
          stats.compilation.modules.forEach(module => {
            if (module._asset) {
              assets.push(module._asset);
            }
          });
          fs.writeFileSync(path.join(builder.dllBuildDir, `${vendorKey}.assets`), JSON.stringify(assets));

          const meta = { name: vendorKey, hashes: {}, modules: config.entry.vendor, version: SPIN_DLL_VERSION };
          for (const filename of Object.keys(json.content)) {
            if (filename.indexOf(' ') < 0) {
              meta.hashes[filename] = crypto
                .createHash('md5')
                .update(fs.readFileSync(filename))
                .digest('hex');
              fs.writeFileSync(path.join(builder.dllBuildDir, `${name}_dll_hashes.json`), JSON.stringify(meta));
            }
          }
        } catch (e) {
          logger.error(e.stack);
          process.exit(1);
        }
        done();
      });

      compiler.run(reporter);
    } else {
      done();
    }
  });
};

const setupExpoDir = (spin: Spin, dir, platform) => {
  const reactNativeDir = path.join(dir, 'node_modules', 'react-native');
  mkdirp.sync(path.join(reactNativeDir, 'local-cli'));
  fs.writeFileSync(
    path.join(reactNativeDir, 'package.json'),
    fs.readFileSync(spin.require.resolve('react-native/package.json'))
  );
  fs.writeFileSync(path.join(reactNativeDir, 'local-cli/cli.js'), '');
  const pkg = JSON.parse(fs.readFileSync('package.json').toString());
  const origDeps = pkg.dependencies;
  pkg.dependencies = { 'react-native': origDeps['react-native'] };
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
    fs.writeFileSync(path.join(dir, '.exprc'), JSON.stringify({ manifestPort: expoPorts[platform] }));
  }
};

const startExpoServer = async (spin: Spin, projectRoot: string, packagerPort) => {
  const { Config, Project, ProjectSettings } = spin.require('xdl');

  Config.validation.reactNativeVersionWarnings = false;
  Config.developerTool = 'crna';
  Config.offline = true;

  await Project.startExpoServerAsync(projectRoot);
  await ProjectSettings.setPackagerInfoAsync(projectRoot, {
    packagerPort
  });
};

const startExpoProject = async (spin, config, platform, logger) => {
  const { UrlUtils, Android, Simulator } = spin.require('xdl');
  const qr = spin.require('qrcode-terminal');

  try {
    const projectRoot = path.join(path.resolve('.'), '.expo', platform);
    setupExpoDir(spin, projectRoot, platform);
    await startExpoServer(spin, projectRoot, config.devServer.port);

    const address = await UrlUtils.constructManifestUrlAsync(projectRoot);
    const localAddress = await UrlUtils.constructManifestUrlAsync(projectRoot, {
      hostType: 'localhost'
    });
    logger.info(`Expo address for ${platform}, Local: ${localAddress}, LAN: ${address}`);
    logger.info(
      "To open this app on your phone scan this QR code in Expo Client (if it doesn't get started automatically)"
    );
    qr.generate(address, code => {
      logger.info('\n' + code);
    });
    if (!containerized()) {
      if (platform === 'android') {
        const { success, error } = await Android.openProjectAsync(projectRoot);

        if (!success) {
          logger.error(error.message);
        }
      } else if (platform === 'ios') {
        const { success, msg } = await Simulator.openUrlInSimulatorSafeAsync(localAddress);

        if (!success) {
          logger.error('Failed to start Simulator: ', msg);
        }
      }
    }
  } catch (e) {
    logger.error(e.stack);
  }
};

const startWebpack = async (spin: Spin, platforms: any, builder: Builder) => {
  const VirtualModules = spin.require('webpack-virtual-modules');
  if (!frontendVirtualModules) {
    frontendVirtualModules = new VirtualModules({ 'node_modules/backend_reload.js': '' });
  }

  if (builder.stack.platform === 'server') {
    startServerWebpack(spin, builder);
  } else {
    startClientWebpack(!!platforms.server, spin, builder);
  }
};

const allocateExpoPorts = async expoPlatforms => {
  let startPort = 19000;
  for (const platform of expoPlatforms) {
    const expoPort = await detectPort(startPort);
    expoPorts[platform] = expoPort;
    startPort = expoPort + 1;
  }
};

const startExpoProdServer = async (spin: Spin, builders: Builders, logger) => {
  const connect = spin.require('connect');
  const mime = spin.require('mime', spin.require.resolve('webpack-dev-middleware'));
  const compression = spin.require('compression');
  const statusPageMiddleware = spin.require('react-native/local-cli/server/middleware/statusPageMiddleware.js');
  const { UrlUtils } = spin.require('xdl');

  logger.info(`Starting Expo prod server`);
  const packagerPort = 3030;

  const app = connect();
  app
    .use((req, res, next) => {
      req.path = req.url.split('?')[0];
      debug(`Prod mobile packager request: ${req.url}`);
      next();
    })
    .use(statusPageMiddleware)
    .use(compression())
    .use(debugMiddleware)
    .use((req, res, next) => {
      const platform = url.parse(req.url, true).query.platform;
      if (platform) {
        let platformFound: boolean = false;
        for (const name of Object.keys(builders)) {
          const builder = builders[name];
          if (builder.stack.hasAny(platform)) {
            platformFound = true;
            const filePath = builder.buildDir
              ? path.join(builder.buildDir, req.path)
              : path.join(builder.frontendBuildDir || `build/client`, platform, req.path);
            if (fs.existsSync(filePath)) {
              res.writeHead(200, { 'Content-Type': mime.lookup ? mime.lookup(filePath) : mime.getType(filePath) });
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
        }

        if (!platformFound) {
          logger.error(
            `Bundle for '${platform}' platform is missing! You need to build bundles both for Android and iOS.`
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(`{'message': 'File not found for request: ${req.path}'}`);
        }
      } else {
        next();
      }
    });

  const serverInstance: any = http.createServer(app);

  await new Promise((resolve, reject) => {
    serverInstance.listen(packagerPort, () => {
      logger.info(`Production mobile packager listening on http://localhost:${packagerPort}`);
      resolve();
    });
  });

  serverInstance.timeout = 0;
  serverInstance.keepAliveTimeout = 0;

  const projectRoot = path.join(path.resolve('.'), '.expo', 'all');
  await startExpoServer(spin, projectRoot, packagerPort);
  const localAddress = await UrlUtils.constructManifestUrlAsync(projectRoot, {
    hostType: 'localhost'
  });
  logger.info(`Expo server running on address: ${localAddress}`);
};

const startExp = async (spin: Spin, builders: Builders, logger) => {
  let hasMobileBuilders: boolean = false;
  for (const name of Object.keys(builders)) {
    const builder = builders[name];
    if (builder.stack.hasAny(['ios', 'android'])) {
      hasMobileBuilders = true;
      break;
    }
  }
  if (!hasMobileBuilders) {
    throw new Error('Builders for `ios` or `android` not found');
  }

  const projectRoot = path.join(process.cwd(), '.expo', 'all');
  setupExpoDir(spin, projectRoot, 'all');
  const expIdx = process.argv.indexOf('exp');
  if (['ba', 'bi', 'build:android', 'build:ios', 'publish', 'p', 'server'].indexOf(process.argv[expIdx + 1]) >= 0) {
    await startExpoProdServer(spin, builders, logger);
  }
  if (process.argv[expIdx + 1] !== 'server') {
    const exp = spawn(path.join(process.cwd(), 'node_modules/.bin/exp'), process.argv.splice(expIdx + 1), {
      cwd: projectRoot,
      stdio: [0, 1, 2]
    });
    exp.on('exit', code => {
      process.exit(code);
    });
  }
};

const execute = (cmd: string, argv: any, builders: Builders, spin: Spin) => {
  if (argv.verbose) {
    Object.keys(builders).forEach(name => {
      const builder = builders[name];
      spinLogger.log(`${name} = `, require('util').inspect(builder.config, false, null));
    });
  }

  if (cmd === 'exp') {
    startExp(spin, builders, spinLogger);
  } else if (cmd === 'test') {
    // TODO: Remove this in 0.5.x
    let builder;
    for (const name of Object.keys(builders)) {
      builder = builders[name];
      if (builder.roles.indexOf('test') >= 0) {
        break;
      }
    }
    const testArgs = [
      '--include',
      'babel-polyfill',
      '--webpack-config',
      spin.require.resolve('spinjs/webpack.config.js')
    ];
    if (builder.stack.hasAny('react')) {
      const majorVer = spin.require('react/package.json').version.split('.')[0];
      const reactVer = majorVer >= 16 ? majorVer : 15;
      if (reactVer >= 16) {
        testArgs.push('--include', 'raf/polyfill');
      }
    }

    const testCmd = path.join(process.cwd(), 'node_modules/.bin/mocha-webpack');
    testArgs.push.apply(testArgs, process.argv.slice(process.argv.indexOf('test') + 1));
    spinLogger.info(`Running ${testCmd} ${testArgs.join(' ')}`);

    const env: any = Object.create(process.env);
    if (argv.c) {
      (env.SPIN_CWD = spin.cwd), (env.SPIN_CONFIG = path.resolve(argv.c));
    }

    const mochaWebpack = spawn(testCmd, testArgs, {
      stdio: [0, 1, 2],
      env
    });
    mochaWebpack.on('close', code => {
      process.exit(code);
    });
  } else {
    const expoPlatforms = [];
    const platforms = {};
    Object.keys(builders).forEach(name => {
      const builder = builders[name];
      const stack = builder.stack;
      platforms[stack.platform] = true;
      if (stack.hasAny('react-native') && stack.hasAny('ios')) {
        expoPlatforms.push('ios');
      } else if (stack.hasAny('react-native') && stack.hasAny('android')) {
        expoPlatforms.push('android');
      }
    });
    const prepareExpoPromise =
      spin.watch && expoPlatforms.length > 0 ? allocateExpoPorts(expoPlatforms) : Promise.resolve();
    prepareExpoPromise.then(() => {
      for (const name of Object.keys(builders)) {
        const builder = builders[name];
        const stack = builder.stack;
        if (stack.hasAny(['dll', 'test'])) {
          continue;
        }
        const prepareDllPromise: PromiseLike<any> =
          spin.watch && builder.webpackDll && builder.child
            ? buildDll(stack.platform, builder.child.config, builder, spin)
            : Promise.resolve();
        prepareDllPromise.then(() => startWebpack(spin, platforms, builder));
      }
    });
  }
};

export default execute;
