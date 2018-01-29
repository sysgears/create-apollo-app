import { exec, spawn } from 'child_process';
import * as cluster from 'cluster';
import * as cors from 'connect-cors';
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
const BACKEND_CHANGE_MSG = 'backend_change';

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

const spawnServer = (cwd, serverPath, debugOpt, logger) => {
  server = spawn('node', [debugOpt, serverPath], { stdio: [0, 1, 2], cwd });
  logger(`Spawning ${['node', debugOpt, serverPath].join(' ')}`);
  server.on('exit', code => {
    if (code === 250) {
      // App requested full reload
      startBackend = true;
    }
    logger('Backend has been stopped');
    server = undefined;
    runServer(cwd, serverPath, logger);
  });
};

const runServer = (cwd, serverPath, logger) => {
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
          spawnServer(cwd, serverPath, nodeDebugOpt + '=' + debugPort, logger);
        });
      });
    } else {
      spawnServer(cwd, serverPath, nodeDebugOpt, logger);
    }
  }
};

const webpackReporter = (spin: Spin, builder: Builder, outputPath: string, log, err?, stats?) => {
  if (err) {
    log(err.stack);
    throw new Error('Build error');
  }
  if (stats) {
    const str = stats.toString(builder.config.stats);
    if (str.length > 0) {
      log(str);
    }

    if (builder.writeStats) {
      mkdirp.sync(outputPath);
      fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats.toJson()));
    }
  }
  if (!spin.watch && cluster.isWorker) {
    process.exit(0);
  }
};

const frontendVirtualModules = [];

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
  const webpack = builder.require('webpack');

  const config = builder.config;
  const configOutputPath = config.output.path;

  const VirtualModules = builder.require('webpack-virtual-modules');
  const clientVirtualModules = new VirtualModules({ 'node_modules/backend_reload.js': '' });
  config.plugins.push(clientVirtualModules);
  frontendVirtualModules.push(clientVirtualModules);

  const logger = minilog(`webpack-for-${config.name}`);
  try {
    const reporter = (...args) => webpackReporter(spin, builder, configOutputPath, logger, ...args);

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
  for (const virtualModules of frontendVirtualModules) {
    virtualModules.writeModule('node_modules/backend_reload.js', `var count = ${backendReloadCount};\n`);
  }
};

const startServerWebpack = (spin, builder) => {
  const config = builder.config;
  const logger = minilog(`webpack-for-${config.name}`);

  try {
    const webpack = builder.require('webpack');
    const reporter = (...args) => webpackReporter(spin, builder, config.output.path, logger, ...args);

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
                if (module.built && module.resource && module.resource.split(/[\\\/]/).indexOf('server') >= 0) {
                  // Force front-end refresh on back-end change
                  logger.debug('Force front-end current page refresh, due to change in backend at:', module.resource);
                  process.send({ cmd: BACKEND_CHANGE_MSG });
                  break;
                }
              }
            }
          } else {
            runServer(builder.require.cwd, path.join(output.path, 'index.js'), logger);
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
  const openurl = builder.require('openurl');
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
      startExpoProject(spin, builder, logger);
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
  const webpack = builder.require('webpack');
  const waitOn = builder.require('wait-on');

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
    const relJson = JSON.parse(fs.readFileSync(path.resolve('./' + jsonPath)).toString());
    const json = { ...relJson, content: {} };

    for (const relPath of Object.keys(relJson.content)) {
      const filename = builder.require.processRelativePath(relPath);
      json.content[filename] = relJson.content[relPath];
    }

    config.plugins.push(
      new webpack.DllReferencePlugin({
        context: process.cwd(),
        manifest: json
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
    const WebpackDevServer = builder.require('webpack-dev-server');

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
    const connect = builder.require('connect');
    const compression = builder.require('compression');
    const httpProxyMiddleware = builder.require('http-proxy-middleware');
    const mime = builder.require('mime', builder.require.resolve('webpack-dev-middleware'));
    const webpackDevMiddleware = builder.require('webpack-dev-middleware');
    const webpackHotMiddleware = builder.require('webpack-hot-middleware');

    const app = connect();

    serverInstance = http.createServer(app);
    mime.define({ 'application/javascript': ['bundle'] }, true);
    mime.define({ 'application/json': ['assets'] }, true);

    messageSocket = builder.require('react-native/local-cli/server/util/messageSocket.js');
    webSocketProxy = builder.require('react-native/local-cli/server/util/webSocketProxy.js');

    try {
      const InspectorProxy = builder.require('react-native/local-cli/server/util/inspectorProxy.js');
      inspectorProxy = new InspectorProxy();
    } catch (ignored) {}
    const copyToClipBoardMiddleware = builder.require(
      'react-native/local-cli/server/middleware/copyToClipBoardMiddleware'
    );
    let cpuProfilerMiddleware;
    try {
      cpuProfilerMiddleware = builder.require('react-native/local-cli/server/middleware/cpuProfilerMiddleware');
    } catch (ignored) {}
    const getDevToolsMiddleware = builder.require('react-native/local-cli/server/middleware/getDevToolsMiddleware');
    let heapCaptureMiddleware;
    try {
      heapCaptureMiddleware = builder.require('react-native/local-cli/server/middleware/heapCaptureMiddleware.js');
    } catch (ignored) {}
    const indexPageMiddleware = builder.require('react-native/local-cli/server/middleware/indexPage');
    const loadRawBodyMiddleware = builder.require('react-native/local-cli/server/middleware/loadRawBodyMiddleware');
    const openStackFrameInEditorMiddleware = builder.require(
      'react-native/local-cli/server/middleware/openStackFrameInEditorMiddleware'
    );
    const statusPageMiddleware = builder.require('react-native/local-cli/server/middleware/statusPageMiddleware.js');
    const systraceProfileMiddleware = builder.require(
      'react-native/local-cli/server/middleware/systraceProfileMiddleware.js'
    );
    const unless = builder.require('react-native/local-cli/server/middleware/unless');
    const symbolicateMiddleware = builder.require('haul/src/server/middleware/symbolicateMiddleware');

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

    const args = {
      port: config.devServer.port,
      projectRoots: [path.resolve('.')]
    };
    app
      .use(cors())
      .use(loadRawBodyMiddleware)
      .use((req, res, next) => {
        req.path = req.url.split('?')[0];
        const origWriteHead = res.writeHead;
        res.writeHead = (...parms) => {
          const code = parms[0];
          if (code === 404) {
            logger.error(`404 at URL ${req.url}`);
            if (req.url.indexOf('assets') >= 0) {
              const outputPath = builder.child.config.output.path;
              const dumpFs = (fileSys, rootDir, dir) =>
                fileSys
                  .readdirSync(path.join(rootDir, dir))
                  .reduce(
                    (files, file) =>
                      fileSys.statSync(path.join(rootDir, dir, file)).isDirectory()
                        ? files.concat(dumpFs(fileSys, rootDir, path.join(dir, file)))
                        : files.concat(path.join(dir, file)),
                    []
                  );
              logger.info(
                `Is disk file exist ${path.join(outputPath, req.path)} ${fs.existsSync(
                  path.join(outputPath, req.path)
                )}`
              );
              logger.info(
                `Is mem file exist ${req.path} ${fs.existsSync(devMiddleware.fileSystem.existsSync(req.path))}`
              );
              debug(`${builder.name} Disk fs dump at ${outputPath}:`, dumpFs(fs, outputPath, ''));
              debug(`${builder.name} Mem fs dump:`, dumpFs(devMiddleware.fileSystem, '/', ''));
            }
          }
          origWriteHead.apply(res, parms);
        };
        if (req.path !== '/onchange') {
          logger.debug(`${builder.name} Dev mobile packager request: ${req.path}`);
        }
        next();
      })
      .use(compression());
    app.use('/assets', serveStatic(path.join(builder.require.cwd, '.expo', builder.stack.platform)));
    if (builder.child) {
      app.use(serveStatic(builder.child.config.output.path));
    }
    app
      .use((req, res, next) => {
        if (req.path === '/debugger-ui/deltaUrlToBlobUrl.js') {
          debug(`${builder.name} serving monkey patched deltaUrlToBlobUrl`);
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(`window.deltaUrlToBlobUrl = function(url) { return url.replace('.delta', '.bundle'); }`);
        } else {
          next();
        }
      })
      .use(
        '/debugger-ui',
        serveStatic(
          path.join(
            path.dirname(builder.require.resolve('react-native/package.json')),
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
      .use(debugMiddleware);
    if (heapCaptureMiddleware) {
      app.use(heapCaptureMiddleware);
    }
    if (cpuProfilerMiddleware) {
      app.use(cpuProfilerMiddleware);
    }
    if (inspectorProxy) {
      app.use(unless('/inspector', inspectorProxy.processRequest.bind(inspectorProxy)));
    }

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

const isDllValid = (spin, builder, logger): boolean => {
  const name = `vendor_${builder.stack.platform}`;
  try {
    const hashesPath = path.join(builder.dllBuildDir, `${name}_dll_hashes.json`);
    if (!fs.existsSync(hashesPath)) {
      return false;
    }
    const relMeta = JSON.parse(fs.readFileSync(hashesPath).toString());
    if (SPIN_DLL_VERSION !== relMeta.version) {
      return false;
    }
    if (!fs.existsSync(path.join(builder.dllBuildDir, relMeta.name))) {
      return false;
    }
    if (builder.sourceMap && !fs.existsSync(path.join(builder.dllBuildDir, relMeta.name + '.map'))) {
      return false;
    }
    if (!_.isEqual(relMeta.modules, builder.config.entry.vendor)) {
      return false;
    }

    const relJson = JSON.parse(fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`)).toString());

    for (const relPath of Object.keys(relJson.content)) {
      const filename = builder.require.processRelativePath(relPath);
      if (filename.indexOf(' ') < 0 && filename.indexOf('@virtual') < 0) {
        if (!fs.existsSync(filename)) {
          logger.warn(`${name} DLL need to be regenerated, file: ${filename} is missing.`);
          return false;
        }
        const hash = crypto
          .createHash('md5')
          .update(fs.readFileSync(filename))
          .digest('hex');
        if (relMeta.hashes[relPath] !== hash) {
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

const buildDll = (spin: Spin, builder: Builder) => {
  const webpack = builder.require('webpack');
  const config = builder.child.config;
  return new Promise(done => {
    const name = `vendor_${builder.stack.platform}`;
    const logger = minilog(`webpack-for-${config.name}`);
    const reporter = (...args) => webpackReporter(spin, builder, config.output.path, logger, ...args);

    if (!isDllValid(spin, builder, logger)) {
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

          const meta = { name: vendorKey, hashes: {}, modules: builder.config.entry.vendor, version: SPIN_DLL_VERSION };
          for (const filename of Object.keys(json.content)) {
            if (filename.indexOf(' ') < 0 && filename.indexOf('@virtual') < 0) {
              meta.hashes[filename] = crypto
                .createHash('md5')
                .update(fs.readFileSync(filename))
                .digest('hex');
            }
          }

          const relJson = { ...json, content: {} };
          const relMeta = { ...meta, hashes: {} };
          for (const filename of Object.keys(json.content)) {
            const relPath = builder.require.builderRelativePath(filename);
            relJson.content[relPath] = json.content[filename];
            relMeta.hashes[relPath] = meta.hashes[filename];
          }

          fs.writeFileSync(path.join(builder.dllBuildDir, `${name}_dll_hashes.json`), JSON.stringify(relMeta));
          fs.writeFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`), JSON.stringify(relJson));
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

const setupExpoDir = (spin: Spin, builder: Builder, dir, platform) => {
  const reactNativeDir = path.join(dir, 'node_modules', 'react-native');
  mkdirp.sync(path.join(reactNativeDir, 'local-cli'));
  fs.writeFileSync(
    path.join(reactNativeDir, 'package.json'),
    fs.readFileSync(builder.require.resolve('react-native/package.json'))
  );
  fs.writeFileSync(path.join(reactNativeDir, 'local-cli/cli.js'), '');
  const pkg = JSON.parse(fs.readFileSync(builder.require.resolve('./package.json')).toString());
  const origDeps = pkg.dependencies;
  pkg.dependencies = { 'react-native': origDeps['react-native'] };
  if (platform !== 'all') {
    pkg.name = pkg.name + '-' + platform;
  }
  pkg.main = `index.mobile`;
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  const appJson = JSON.parse(fs.readFileSync(builder.require.resolve('./app.json')).toString());
  if (appJson.expo.icon) {
    const iconPath = path.join(builder.require.cwd, appJson.expo.icon);
    fs.writeFileSync(path.join(dir, path.basename(iconPath)), fs.readFileSync(iconPath));
    appJson.expo.icon = path.basename(iconPath);
  }
  fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(appJson));
  if (platform !== 'all') {
    fs.writeFileSync(path.join(dir, '.exprc'), JSON.stringify({ manifestPort: expoPorts[platform] }));
  }
};

const startExpoServer = async (spin: Spin, builder: Builder, projectRoot: string, packagerPort) => {
  const { Config, Project, ProjectSettings } = builder.require('xdl');

  Config.validation.reactNativeVersionWarnings = false;
  Config.developerTool = 'crna';
  Config.offline = true;

  await Project.startExpoServerAsync(projectRoot);
  await ProjectSettings.setPackagerInfoAsync(projectRoot, {
    packagerPort
  });
};

const startExpoProject = async (spin: Spin, builder: Builder, logger: any) => {
  const { UrlUtils, Android, Simulator } = builder.require('xdl');
  const qr = builder.require('qrcode-terminal');
  const platform = builder.stack.platform;

  try {
    const projectRoot = path.join(builder.require.cwd, '.expo', platform);
    setupExpoDir(spin, builder, projectRoot, platform);
    await startExpoServer(spin, builder, projectRoot, builder.config.devServer.port);

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

const startWebpack = async (spin: Spin, builder: Builder, platforms: any) => {
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

const startExpoProdServer = async (spin: Spin, mainBuilder: Builder, builders: Builders, logger) => {
  const connect = mainBuilder.require('connect');
  const mime = mainBuilder.require('mime', mainBuilder.require.resolve('webpack-dev-middleware'));
  const compression = mainBuilder.require('compression');
  const statusPageMiddleware = mainBuilder.require('react-native/local-cli/server/middleware/statusPageMiddleware.js');
  const { UrlUtils } = mainBuilder.require('xdl');

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
          res.end(`{"message": "File not found for request: ${req.path}"}`);
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
  await startExpoServer(spin, mainBuilder, projectRoot, packagerPort);
  const localAddress = await UrlUtils.constructManifestUrlAsync(projectRoot, {
    hostType: 'localhost'
  });
  logger.info(`Expo server running on address: ${localAddress}`);
};

const startExp = async (spin: Spin, builders: Builders, logger) => {
  let mainBuilder: Builder;
  for (const name of Object.keys(builders)) {
    const builder = builders[name];
    if (builder.stack.hasAny(['ios', 'android'])) {
      mainBuilder = builder;
      break;
    }
  }
  if (!mainBuilder) {
    throw new Error('Builders for `ios` or `android` not found');
  }

  const projectRoot = path.join(process.cwd(), '.expo', 'all');
  setupExpoDir(spin, mainBuilder, projectRoot, 'all');
  const expIdx = process.argv.indexOf('exp');
  if (['ba', 'bi', 'build:android', 'build:ios', 'publish', 'p', 'server'].indexOf(process.argv[expIdx + 1]) >= 0) {
    await startExpoProdServer(spin, mainBuilder, builders, logger);
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

const runBuilder = (spin: Spin, builder: Builder, platforms) => {
  const prepareDllPromise: PromiseLike<any> =
    spin.watch && builder.webpackDll && builder.child ? buildDll(spin, builder) : Promise.resolve();
  prepareDllPromise.then(() => startWebpack(spin, builder, platforms));
};

const execute = (cmd: string, argv: any, builders: Builders, spin: Spin) => {
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

  if (cluster.isMaster) {
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
          const testArgs = [
            '--include',
            'babel-polyfill',
            '--webpack-config',
            builder.require.resolve('spinjs/webpack.config.js')
          ];
          if (builder.stack.hasAny('react')) {
            const majorVer = builder.require('react/package.json').version.split('.')[0];
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
            env,
            cwd: builder.require.cwd
          });
          mochaWebpack.on('close', code => {
            if (code !== 0) {
              process.exit(code);
            }
          });
        }
      }
    } else {
      const prepareExpoPromise =
        spin.watch && expoPlatforms.length > 0 ? allocateExpoPorts(expoPlatforms) : Promise.resolve();
      prepareExpoPromise.then(() => {
        const workerBuilders = {};

        let potentialWorkerCount = 0;
        for (const id of Object.keys(builders)) {
          const builder = builders[id];
          if (builder.stack.hasAny(['dll', 'test'])) {
            continue;
          }
          if (builder.cluster !== false) {
            potentialWorkerCount++;
          }
        }

        for (const id of Object.keys(builders)) {
          const builder = builders[id];
          if (builder.stack.hasAny(['dll', 'test'])) {
            continue;
          }

          if (potentialWorkerCount > 1 && !builder.cluster) {
            const worker = cluster.fork({ BUILDER_ID: id, EXPO_PORTS: JSON.stringify(expoPorts) });
            workerBuilders[worker.process.pid] = builder;
          } else {
            runBuilder(spin, builder, platforms);
          }
        }

        for (const id of Object.keys(cluster.workers)) {
          cluster.workers[id].on('message', msg => {
            debug(`Master received message ${JSON.stringify(msg)}`);
            for (const wid of Object.keys(cluster.workers)) {
              cluster.workers[wid].send(msg);
            }
          });
        }

        cluster.on('exit', (worker, code, signal) => {
          debug(`Worker ${workerBuilders[worker.process.pid].id} died`);
        });
      });
    }
  } else {
    const builder = builders[process.env.BUILDER_ID];
    const builderExpoPorts = JSON.parse(process.env.EXPO_PORTS);
    for (const platform of Object.keys(builderExpoPorts)) {
      expoPorts[platform] = builderExpoPorts[platform];
    }
    process.on('message', msg => {
      if (msg.cmd === BACKEND_CHANGE_MSG) {
        debug(`Increase backend reload count in ${builder.id}`);
        increaseBackendReloadCount();
      }
    });

    runBuilder(spin, builder, platforms);
  }
};

export default execute;
