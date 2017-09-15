import * as fs from 'fs';

import requireModule from '../requireModule';
import { ConfigPlugin } from '../ConfigPlugin';
import { Builder } from '../Builder';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TypeScriptPlugin implements ConfigPlugin {
    configure(builder: Builder, spin: Spin) {
        const stack = builder.stack;

        if (stack.hasAll(['typescript', 'webpack'])) {
            const jsRuleFinder = new JSRuleFinder(builder);
            const jsRule = jsRuleFinder.rule;
            jsRule.use = spin.merge(jsRule.use, {
            });

            if (!stack.hasAny('dll')) {
                for (let key in builder.config.entry) {
                    const entry = builder.config.entry[key];
                    for (let idx = 0; idx < entry.length; idx++) {
                        const item = entry[idx];
                        const tsItem = path.join(path.dirname(item),
                            path.basename(item, path.extname(item)), '.ts');
                        if (!fs.existsSync(item) && fs.existsSync(tsItem)) {
                            entry[idx] = tsItem;
                        }
                    }
                }

            }
        }
    }
}