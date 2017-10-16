import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import requireModule from '../requireModule';
import Spin from '../Spin';

export default class ReactNativeWebPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native-web', 'server', 'webpack'])) {
      const nodeExternals = requireModule('webpack-node-externals');
      const nodeExternalsFn = nodeExternals({
        whitelist: [/(^webpack|^react-native)/]
      });
      builder.config = spin.merge(builder.config, {
        resolve: {
          alias: {
            'react-native': 'react-native-web'
          }
        }
      });
      builder.config.externals = (context, request, callback) => {
        return nodeExternalsFn(context, request, (...args) => {
          if (request.indexOf('react-native') >= 0) {
            return callback(null, 'commonjs ' + request + '-web');
          } else {
            return callback.apply(this, args);
          }
        });
      };
    }
  }
}
