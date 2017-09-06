import Spin from "../Spin";
import { ConfigPlugin } from "../ConfigPlugin";
import { Builder } from "../Builder";
import requireModule from '../requireModule';

export default class ReactNativeWebPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['react-native-web', 'server', 'webpack'])) {
            const nodeExternals = requireModule('webpack-node-externals');
            const nodeExternalsFn = nodeExternals({
                whitelist: [/(^webpack|^react-native)/],
            });
            builder.config = spin.merge(builder.config, {
                resolve: {
                    alias: {
                        'react-native': 'react-native-web',
                    }
                }
            });
            builder.config.externals = function(context, request, callback) {
                return nodeExternalsFn(context, request, function () {
                    if (request.indexOf('react-native') >= 0) {
                        return callback(null, 'commonjs ' + request + '-web');
                    } else {
                        return callback.apply(this, arguments);
                    }
                });
            };
        }
    }
}