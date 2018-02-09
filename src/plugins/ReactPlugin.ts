import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ReactPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react', 'webpack']) && !stack.hasAny('dll')) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findJSRule();
      const tsRule = jsRuleFinder.findTSRule();
      if (jsRule) {
        jsRule.test = /^(?!.*[\\\/]node_modules[\\\/]).*\.jsx?$/;
        if (jsRule.use && jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0 && !jsRule.use.options.babelrc) {
          jsRule.use.options.only = jsRuleFinder.extensions.map(ext => '*.' + ext);
        }
      }
      if (tsRule) {
        tsRule.test = /^(?!.*[\\\/]node_modules[\\\/]).*\.tsx?$/;
      }

      const majorVer = builder.require('react/package.json').version.split('.')[0];
      const reactVer = majorVer >= 16 ? majorVer : 15;
      builder.config.resolve.extensions = (stack.hasAny('web') || stack.hasAny('server') ? ['.web.', '.'] : ['.'])
        .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
        .reduce((acc, val) => acc.concat(val));

      if (stack.hasAny('web')) {
        for (const key of Object.keys(builder.config.entry)) {
          const entry = builder.config.entry[key];
          for (let idx = 0; idx < entry.length; idx++) {
            const item = entry[idx];
            if (['.tsx', '.jsx', '.ts', '.js'].indexOf(path.extname(item)) >= 0 && item.indexOf('node_modules') < 0) {
              const baseItem = path.join(path.dirname(item), path.basename(item, path.extname(item)));
              for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
                if (fs.existsSync(baseItem + ext)) {
                  entry[idx] = (baseItem.startsWith('.') ? '' : './') + baseItem + ext;
                }
              }
            }
          }
        }
      }

      if (reactVer >= 16) {
        builder.config = spin.merge(
          {
            entry: {
              index: [`raf/polyfill`]
            }
          },
          builder.config
        );
      }
    }
  }
}
