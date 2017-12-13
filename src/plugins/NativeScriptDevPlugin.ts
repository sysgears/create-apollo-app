import * as minilog from 'minilog';
import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class NativeScriptDevPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;
    const logger = minilog('NativeScriptDevPlugin');

    if (stack.hasAll(['native-script', 'angular', 'webpack'])) {
      const { resolve, join } = requireModule('path');
      const webpack = requireModule('webpack');
      const ngToolsWebpackOptions = { tsConfigPath: 'tsconfig.aot.json' };
      const CopyWebpackPlugin = requireModule('copy-webpack-plugin');
      const { GenerateBundleStarterPlugin, UrlResolvePlugin } = requireModule(
        'spinjs/lib/plugins/native-script/plugins'
      );
      const { NativeScriptWorkerPlugin } = requireModule('nativescript-worker-loader/NativeScriptWorkerPlugin');
      const { BundleAnalyzerPlugin } = requireModule('webpack-bundle-analyzer');
      const { AotPlugin } = requireModule('@ngtools/webpack');

      const jsRuleFinder = new JSRuleFinder(builder);
      const tsRule = jsRuleFinder.findAndCreateTSRule();

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.html$|\.xml$/,
              use: ['raw-loader']
            },
            // Compile TypeScript files with ahead-of-time compiler.
            {
              test: /.ts$/,
              use: [
                { loader: 'spinjs/tns-aot-loader' },
                {
                  loader: '@ngtools/webpack',
                  options: ngToolsWebpackOptions
                }
              ]
            }
          ]
        },
        resolve: {
          plugins: [
            // Vendor libs go to the vendor.js chunk
            new webpack.optimize.CommonsChunkPlugin({
              name: ['vendor']
            }),

            // Define useful constants like TNS_WEBPACK
            new webpack.DefinePlugin({
              'global.TNS_WEBPACK': 'true'
            }),

            // Copy assets to out dir. Add your own globs as needed.
            new CopyWebpackPlugin(
              [
                { from: 'css/**' },
                { from: 'fonts/**' },
                { from: '**/*.jpg' },
                { from: '**/*.png' },
                { from: '**/*.xml' }
              ],
              { ignore: ['App_Resources/**'] }
            ),

            // Generate a bundle starter script and activate it in package.json
            new GenerateBundleStarterPlugin(['./vendor', './bundle']),

            // Support for web workers since v3.2
            new NativeScriptWorkerPlugin(),

            // Generate report files for bundles content
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              openAnalyzer: false,
              generateStatsFile: true,
              reportFilename: join(__dirname, 'report', `report.html`),
              statsFilename: join(__dirname, 'report', `stats.json`)
            }),

            // Angular AOT compiler
            new AotPlugin({
              entryModule: resolve(__dirname, 'app/app.module#AppModule'),
              typeChecking: false,
              ...ngToolsWebpackOptions
            }),

            // Resolve .ios.css and .android.css component stylesheets, and .ios.html and .android component views
            new UrlResolvePlugin({
              platform: 'angular',
              resolveStylesUrls: true,
              resolveTemplateUrl: true
            })
          ]
        }
      });
    }
  }
}
