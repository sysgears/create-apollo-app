import * as fs from 'fs';
import * as merge from 'webpack-merge';

import ConfigRc from './configRc';
import generateConfig from './generator';
import Stack from './stack';
import requireModule from './requireModule';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let nodes = {};

    const config = new ConfigRc();
    const options = config.options;
    try {
        for (let name in config.nodes) {
            const node = config.nodes[name];
            const stack = node.stack;
            const dev = cmd === 'watch' || cmd === 'test';
            if (node.roles.indexOf(cmd) < 0)
                continue;
            let overrides;
            const overridesConfig = options.overridesConfig || WEBPACK_OVERRIDES_NAME;
            if (fs.existsSync(overridesConfig)) {
                overrides = requireModule('./' + overridesConfig);
            } else {
                overrides = {};
            }
            nodes[name] = { ...node, config: generateConfig(node, config.nodes, dev, options) };
            if (overrides[name]) {
                nodes[name].config = merge(nodes[name].config, overrides[name]);
            }
            if (options.webpackDll && !stack.hasAny('server')) {
                const dllNode: any = {...node};
                const dllNodeName = node.name + 'Dll';
                dllNode.parentName = node.name;
                dllNode.name = dllNodeName;
                dllNode.stack = new Stack(dllNode.stack.technologies, 'dll');
                nodes[name].dllConfig = generateConfig(dllNode, config.nodes, dev, options, overrides.dependencyPlatforms || {});
                if (overrides[dllNodeName]) {
                    nodes[name].dllConfig = merge(nodes[name].dllConfig, overrides[dllNodeName]);
                }
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { nodes, options };
};

export default createConfig;
