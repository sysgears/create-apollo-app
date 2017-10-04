import * as fs from 'fs';

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
import ReactHotLoaderPlugin from './plugins/ReactHotLoaderPlugin';
import TypeScriptPlugin from './plugins/TypeScriptPlugin';
import AngularPlugin from './plugins/AngularPlugin';
import TCombPlugin from './plugins/TCombPlugin';
import FlowRuntimePLugin from './plugins/FlowRuntimePlugin';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const createConfig = cmd => {
    let builders = {};

    const plugins = [
        new WebpackPlugin(),
        new WebAssetsPlugin(),
        new CssProcessorPlugin(),
        new ReactPlugin(),
        new ApolloPlugin(),
        new TypeScriptPlugin(),
        new ES6Plugin(),
        new ReactHotLoaderPlugin(),
        new TCombPlugin(),
        new FlowRuntimePLugin(),
        new ReactNativePlugin(),
        new ReactNativeWebPlugin(),
        new StyledComponentsPlugin(),
        new AngularPlugin(),
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

    for (let name in builders) {
        const builder = builders[name];
        config.plugins.forEach((plugin: ConfigPlugin) => plugin.configure(builder, spin));
        if (overrides[name]) {
            builders[name].config = spin.mergeWithStrategy({
                entry: 'replace',
            }, builders[name].config, overrides[name]);
        }
    }

    return { builders, options: spin.options };
};

export default createConfig;
