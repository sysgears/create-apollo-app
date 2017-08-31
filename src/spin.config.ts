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
import { Builder } from "./Builder";
import ApolloPlugin from "./plugins/ApolloPlugin";
import ReactNativePlugin from "./plugins/ReactNativePlugin";
import ReactNativeWebPlugin from "./plugins/ReactNativeWebPlugin";
import StyledComponentsPlugin from "./plugins/StyledComponentsPlugin";

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let builders = {};

    const plugins = [
        new CssProcessorPlugin(),
        new ApolloPlugin(),
        new ES6Plugin(),
        new ReactNativePlugin(),
        new ReactNativeWebPlugin(),
        new StyledComponentsPlugin(),
    ];
    const config = new ConfigRc(plugins);
    const spin = new Spin(process.argv, config.builders, config.options);

    for (let name in config.builders) {
        const builder = config.builders[name];
        const stack = builder.stack;

        if (builder.enabled === false || builder.roles.indexOf(cmd) < 0) {
            continue;
        }

        if (spin.options.webpackDll && !stack.hasAny('server')) {
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
        const overridesConfig = spin.options.overridesConfig || WEBPACK_OVERRIDES_NAME;
        let overrides;
        if (fs.existsSync(overridesConfig)) {
            overrides = requireModule('./' + overridesConfig);
        } else {
            overrides = {};
        }

        for (let name in builders) {
            const builder = builders[name];
            builders[name].config = generateConfig(builder, spin, overrides.dependencyPlatforms || {});
            config.plugins.forEach((plugin: SpinPlugin) => plugin.configure(builder, spin));
            if (overrides[name]) {
                builders[name].config = merge(builders[name].config, overrides[name]);
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { builders, options: spin.options };
};

export default createConfig;
