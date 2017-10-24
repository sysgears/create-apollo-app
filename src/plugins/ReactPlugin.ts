import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ReactPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['react', 'webpack']);
  }

  public init(builder: Builder, spin: Spin): InitConfig {
    return {
      dependencies: [
        'prop-types',
        'react',
        'react-dom',
        'react-redux',
        'react-router',
        'react-router-dom',
        'react-router-redux',
        'redux'
      ],
      devDependencies: ['react-addons-test-utils', 'react-test-renderer', 'redux-devtools-extension']
    };
  }

  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    const jsRuleFinder = new JSRuleFinder(builder);
    const jsRule = jsRuleFinder.rule;
    const isTypeScript = String(jsRule.test).indexOf('ts') >= 0;
    jsRule.test = isTypeScript ? /\.tsx?$/ : /\.jsx?$/;
    if (jsRule.use && jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0) {
      jsRule.use.options.only = jsRuleFinder.extensions.map(ext => '*.' + ext);
    }

    builder.config.resolve.extensions = (stack.hasAny('web') || stack.hasAny('server') ? ['.web.', '.'] : ['.'])
      .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
      .reduce((acc, val) => acc.concat(val));

    if (stack.hasAny('web') && !stack.hasAny('dll')) {
      for (const key of Object.keys(builder.config.entry)) {
        const entry = builder.config.entry[key];
        for (let idx = 0; idx < entry.length; idx++) {
          const item = entry[idx];
          if (
            item.startsWith('./') &&
            ['.js', '.jsx', '.ts', '.tsx'].indexOf(path.extname(item)) >= 0 &&
            item.indexOf('node_modules') < 0
          ) {
            const jsxItem =
              './' +
              path.join(path.dirname(item), path.basename(item, path.extname(item))) +
              (isTypeScript ? '.tsx' : '.jsx');
            if (!fs.existsSync(item) && fs.existsSync(jsxItem)) {
              entry[idx] = jsxItem;
            }
          }
        }
      }
    }
  }
}
