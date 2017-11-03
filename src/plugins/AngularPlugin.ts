import * as path from 'path';

import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class AngularPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['angular', 'webpack']);
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['angular', 'webpack'])) {
      const webpack = requireModule('webpack');

      const jsRuleFinder = new JSRuleFinder(builder);
      const tsRule = jsRuleFinder.findAndCreateTSRule();
      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: tsRule.test,
              use: requireModule.resolve('angular2-template-loader')
            }
          ]
        },
        plugins: [
          // Workaround for angular/angular#11580
          new webpack.ContextReplacementPlugin(
            // The (\\|\/) piece accounts for path separators in *nix and Windows
            /angular[\\\/]core[\\\/]@angular/,
            path.resolve('src'),
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

        const { CheckerPlugin } = requireModule('awesome-typescript-loader');

        builder.config = spin.merge(builder.config, {
          module: {
            rules: [
              {
                test: /\.html$/,
                loader: requireModule.resolve('html-loader')
              }
            ]
          },
          plugins: [new CheckerPlugin()]
        });
      }
    }
  }
}
