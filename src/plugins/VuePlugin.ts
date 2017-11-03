import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class VuePlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['vue', 'webpack']);
  }

  public init(builder: Builder, spin: Spin): InitConfig {
    return {
      dependencies: []
        .concat(
          builder.stack.hasAny('web') || (builder.stack.hasAny('server') && spin.options.ssr)
            ? ['vue-router', 'vuex', 'vue-class-component', 'vue-rx']
            : []
        )
        .concat(builder.stack.hasAny('server') ? 'vue-server-renderer' : []),
      devDependencies: ['vue-loader']
    };
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
