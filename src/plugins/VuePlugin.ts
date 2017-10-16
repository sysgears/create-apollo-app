import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';

export default class VuePlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['vue', 'webpack'])) {
      const webpack = requireModule('webpack');

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.vue$/,
              use: requireModule.resolve('vue-loader')
            }
          ]
        },
        resolve: {
          alias: {
            vue$: 'vue/dist/vue.esm.js'
          }
        }
      });
    }
  }
}
