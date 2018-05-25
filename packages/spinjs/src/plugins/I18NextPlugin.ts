import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';

export default class I18NextPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['i18next', 'webpack'])) {
      const webpack = builder.require('webpack');

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /locales/,
              use: { loader: '@alienfast/i18next-loader', options: spin.createConfig(builder, 'i18next', {}) }
            }
          ]
        }
      });
    }
  }
}
