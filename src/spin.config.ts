import * as fs from 'fs';
import * as merge from 'webpack-merge';

import ConfigRc from './configRc';
import Stack from './Stack';
import requireModule from './requireModule';
import Spin from './Spin';
import { ConfigPlugin } from './ConfigPlugin';
import CssProcessorPlugin from './plugins/CssProcessorPlugin';
import ES6Plugin from './plugins/ES6Plugin';
import { Builder } from './Builder';
import ApolloPlugin from './plugins/ApolloPlugin';
import ReactNativePlugin from './plugins/ReactNativePlugin';
import ReactNativeWebPlugin from './plugins/ReactNativeWebPlugin';
import StyledComponentsPlugin from './plugins/StyledComponentsPlugin';
import WebAssetsPlugin from './plugins/WebAssetsPlugin';
import ReactPlugin from './plugins/ReactPlugin';
import WebpackPlugin from './plugins/WebpackPlugin';
import NativeBasePlugin from './plugins/NativeBasePlugin';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let builders = {};

    const plugins = [
        new WebpackPlugin(),
        new WebAssetsPlugin(),
        new CssProcessorPlugin(),
        new ReactPlugin(),
        new ApolloPlugin(),
        new ES6Plugin(),
        new ReactNativePlugin(),
        new ReactNativeWebPlugin(),
        new StyledComponentsPlugin(),
        new NativeBasePlugin(),
    ];
    const config = new ConfigRc(plugins);
    const overridesConfig = config.options.overridesConfig || WEBPACK_OVERRIDES_NAME;
    let overrides;
    if (fs.existsSync(overridesConfig)) {
        overrides = requireModule('./' + overridesConfig);
    } else {
        overrides = {};
    }
    const spin = new Spin(cmd, config.builders, config.options, overrides.dependencyPlatforms || {});

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
        for (let name in builders) {
            const builder = builders[name];
            config.plugins.forEach((plugin: ConfigPlugin) => plugin.configure(builder, spin));
            if (overrides[name]) {
                builders[name].config = merge.smartStrategy({
                    entry: 'replace',
                })(builders[name].config, overrides[name]);
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { builders, options: spin.options };
};

export default createConfig;
