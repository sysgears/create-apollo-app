import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class AngularPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['angular', 'webpack'])) {
      const webpack = builder.require('webpack');

      const jsRuleFinder = new JSRuleFinder(builder);
      const tsRule = jsRuleFinder.findAndCreateTSRule();
      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: tsRule.test,
              use: { loader: 'angular2-template-loader', options: spin.createConfig(builder, 'angular2Template', {}) }
            }
          ]
        },
        plugins: [
          // Workaround for angular/angular#11580
          new webpack.ContextReplacementPlugin(
            // The (\\|\/) piece accounts for path separators in *nix and Windows
            /angular[\\\/]core[\\\/]@angular/,
            path.join(builder.require.cwd, 'src'),
            {} // a map of your routes
          )
        ]
      });

      if (!stack.hasAny('dll') && stack.hasAny('web')) {
        builder.config = spin.merge(
          {
            entry: {
              index: [require.resolve('./angular/angular-polyfill.js')]
            }
          },
          builder.config
        );

        const { CheckerPlugin } = builder.require('awesome-typescript-loader');

        builder.config = spin.merge(builder.config, {
          module: {
            rules: [
              {
                test: /\.html$/,
                loader: 'html-loader',
                options: spin.createConfig(builder, 'html', {})
              }
            ]
          },
          plugins: [new CheckerPlugin()]
        });
      }
    }
  }
}
