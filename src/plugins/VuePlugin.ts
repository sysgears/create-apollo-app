import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class VuePlugin implements StackPlugin {
  public detect(builder: any, spin: Spin): boolean {
    return builder.stack.hasAll(['vue', 'webpack']);
  }

  public configure(builder: Builder, spin: Spin) {
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
