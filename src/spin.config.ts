import * as fs from 'fs';
import * as merge from 'webpack-merge';

import ConfigRc from './configRc';
import generateConfig from './generator';
import Stack from './Stack';
import requireModule from './requireModule';
import Spin from "./Spin";
import { SpinPlugin } from "./SpinPlugin";
import CssProcessorPlugin from "./plugins/CssProcessorPlugin";
import ES6Plugin from "./plugins/ES6Plugin";
import {Builder} from "./Builder";

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let builders = {};

    const plugins = [
        new CssProcessorPlugin(),
        new ES6Plugin()
    ];
    const config = new ConfigRc(plugins);
    const options = config.options;
    const spin = new Spin(process.argv, config.builders, config.options);

    for (let name in config.builders) {
        const builder = config.builders[name];
        const stack = builder.stack;

        if (builder.enabled === false || builder.roles.indexOf(cmd) < 0) {
            continue;
        }

        if (options.webpackDll && !stack.hasAny('server')) {
            const dllBuilder: Builder = {...builder} as Builder;
            dllBuilder.name = builder.name + 'Dll';
            dllBuilder.parent = builder;
            dllBuilder.stack = new Stack(dllBuilder.stack.technologies, 'dll');
            builders[dllBuilder.name] = dllBuilder;
            builder.child = dllBuilder;
        }
        builders[name] = builder;
    }

    try {
        const overridesConfig = options.overridesConfig || WEBPACK_OVERRIDES_NAME;
        let overrides;
        if (fs.existsSync(overridesConfig)) {
            overrides = requireModule('./' + overridesConfig);
        } else {
            overrides = {};
        }

        for (let name in builders) {
            const builder = builders[name];
            builders[name].config = generateConfig(builder, config.builders, spin.dev, options, overrides.dependencyPlatforms || {});
            config.plugins.forEach((plugin: SpinPlugin) => plugin.configure(builder, spin));
            if (overrides[name]) {
                builders[name].config = merge(builders[name].config, overrides[name]);
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { builders, options };
};

export default createConfig;
