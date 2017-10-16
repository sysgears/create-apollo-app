import * as path from "path";
import * as fs from "fs";

import requireModule from '../requireModule';
import { ConfigPlugin } from '../ConfigPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TypeScriptPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['ts', 'webpack'])) {
            const jsRuleFinder = new JSRuleFinder(builder);
            const jsRule = jsRuleFinder.rule;
            const { CheckerPlugin } = requireModule('awesome-typescript-loader');
            jsRule.test = /\.ts$/;
            jsRule.use = [{
                loader: requireModule.resolve('awesome-typescript-loader'),
                options: {...builder.tsLoaderOptions}
            }];

            builder.config = spin.merge(builder.config, {
                module: {
                    rules: [
                        {
                            test: /\.html$/,
                            loader: 'html-loader'
                        },
                    ]
                },
                plugins: [
                    new CheckerPlugin()
                ]
            });

            builder.config.resolve.extensions =
                ['.']
                .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
                    .reduce((acc, val) => acc.concat(val));

            if (!stack.hasAny('dll')) {
                for (let key in builder.config.entry) {
                    const entry = builder.config.entry[key];
                    for (let idx = 0; idx < entry.length; idx++) {
                        const item = entry[idx];
                        if (item.startsWith('./')
                            && ['.js', '.jsx', '.ts', '.tsx'].indexOf(path.extname(item)) >= 0
                            && item.indexOf('node_modules') < 0) {
                            const tsItem = './' + path.join(path.dirname(item),
                                path.basename(item, path.extname(item))) + '.ts';
                            if (!fs.existsSync(item) && fs.existsSync(tsItem)) {
                                entry[idx] = tsItem;
                            }
                        }
                    }
                }
            }
        }
    }
}