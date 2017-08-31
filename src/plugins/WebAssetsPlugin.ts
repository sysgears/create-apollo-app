import Spin from "../Spin";
import { SpinPlugin } from "../SpinPlugin";
import { Builder } from "../Builder";

export default class WebAssetsPlugin implements SpinPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['webpack', 'web']) ||
            (stack.hasAll(['webpack', 'server']) && spin.options.ssr)) {
            builder.config = spin.merge(builder.config, {
                module: {
                    rules: [
                        {
                            test: /\.(png|ico|jpg|xml)$/,
                            use: 'url-loader?name=[hash].[ext]&limit=10000',
                        },
                        {
                            test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                            use: 'url-loader?name=./assets/[hash].[ext]&limit=10000',
                        },
                        {
                            test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                            use: 'file-loader?name=./assets/[hash].[ext]',
                        },
                    ]
                }
            });
        } else if (stack.hasAll(['webpack', 'server']) && !spin.options.ssr) {
            builder.config = spin.merge(builder.config, {
                module: {
                    rules: [
                        {
                            test: /\.(png|ico|jpg|xml)$/,
                            use: 'ignore-loader',
                        },
                        {
                            test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                            use: 'ignore-loader',
                        },
                        {
                            test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                            use: 'ignore-loader',
                        },
                    ]
                }
            });
        }
    }
}