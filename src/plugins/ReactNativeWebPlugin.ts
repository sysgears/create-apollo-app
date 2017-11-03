import { Builder } from '../Builder';
import requireModule from '../requireModule';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class ReactNativeWebPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return builder.stack.hasAll(['react-native-web', 'server', 'webpack']);
  }

  public configure(builder: Builder, spin: Spin) {
    builder.config = spin.merge(builder.config, {
      resolve: {
        alias: {
          'react-native': 'react-native-web'
        }
      }
    });

    builder.config.externals = (context, request, callback) => {
      if (request.indexOf('react-native') >= 0) {
        return callback(null, 'commonjs ' + request + '-web');
      } else if (request.indexOf('webpack') < 0 && !request.startsWith('.') && requireModule.probe(request, context)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    };
  }
}
