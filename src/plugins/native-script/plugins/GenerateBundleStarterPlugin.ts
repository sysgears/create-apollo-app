import * as minilog from 'minilog';
import { RawSource } from 'webpack-sources';
import { getPackageJson } from '../projectHelpers';

const logger = minilog('GenerateBundleStarterPlugin');

export default class {
  private bundles: any;
  private webpackContext: any;

  constructor(bundles: any) {
    this.bundles = bundles;
  }

  public apply = (compiler: any) => {
    this.webpackContext = __dirname;

    compiler.plugin('emit', function(compilation, cb) {
      compilation.assets['package.json'] = this.generatePackageJson();
      compilation.assets['starter.js'] = this.generateStarterModule();
      this.generateTnsJavaClasses(compilation);

      cb();
    });
  };

  public generateTnsJavaClasses = (compilation: any) => {
    const path = compilation.compiler.outputPath;
    const isAndroid = path.indexOf('android') > -1;

    if (isAndroid && !compilation.assets['tns-java-classes.js']) {
      compilation.assets['tns-java-classes.js'] = new RawSource('');
    }
  };

  public generatePackageJson = () => {
    const packageJson = getPackageJson(this.webpackContext);
    packageJson.main = 'starter';

    return new RawSource(JSON.stringify(packageJson, null, 4));
  };

  public generateStarterModule = () => {
    const moduleSource = this.bundles.map(bundle => `require("${bundle}")`).join('\n');

    return new RawSource(moduleSource);
  };
}
