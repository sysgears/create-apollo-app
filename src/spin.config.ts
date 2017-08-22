import * as fs from 'fs';
import * as merge from 'webpack-merge';

import ConfigRc from './configRc';
import generateConfig from './generator';
import Stack from './stack';
import requireModule from './requireModule';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let builders = {};

    const config = new ConfigRc();
    const options = config.options;
    try {
        for (let name in config.builders) {
            const builder = config.builders[name];
            const stack = builder.stack;
            const dev = cmd === 'watch' || cmd === 'test';
            if (builder.roles.indexOf(cmd) < 0)
                continue;
            let overrides;
            const overridesConfig = options.overridesConfig || WEBPACK_OVERRIDES_NAME;
            if (fs.existsSync(overridesConfig)) {
                overrides = requireModule('./' + overridesConfig);
            } else {
                overrides = {};
            }
            builders[name] = { ...builder, config: generateConfig(builder, config.builders, dev, options) };
            if (overrides[name]) {
                builders[name].config = merge(builders[name].config, overrides[name]);
            }
            if (options.webpackDll && !stack.hasAny('server')) {
                const dllNode: any = {...builder};
                const dllNodeName = builder.name + 'Dll';
                dllNode.parentName = builder.name;
                dllNode.name = dllNodeName;
                dllNode.stack = new Stack(dllNode.stack.technologies, 'dll');
                builders[name].dllConfig = generateConfig(dllNode, config.builders, dev, options, overrides.dependencyPlatforms || {});
                if (overrides[dllNodeName]) {
                    builders[name].dllConfig = merge(builders[name].dllConfig, overrides[dllNodeName]);
                }
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { builders, options };
};

export default createConfig;
