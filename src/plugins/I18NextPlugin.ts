import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

export default class I18NextPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['i18n', 'webpack'])) {
      const webpack = builder.require('webpack');

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /locales/,
              use: '@alienfast/i18next-loader'
            }
          ]
        }
      });
    }
  }
}
