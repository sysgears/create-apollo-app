import requireModule from './requireModule';
import generateConfig from './generator';
import { Platform } from "./generator";

const pkg = requireModule('./package.json');
const spinConfig = pkg.spin;

const createConfig = cmd => {
    let config = {};

    const options: any = spinConfig.options;

    try {
        options.backendBuildDir = options.backendBuildDir || 'build/server';
        options.frontendBuildDir = options.frontendBuildDir || 'build/client';
        options.dllBuildDir = options.dllBuildDir || 'build/dll';
        options.webpackDevPort = options.webpackDevPort || 3000;

        for (let preset of Object.keys(spinConfig.presets)) {
            const platform = new Platform(preset);
            if (spinConfig.presets[preset]) {
                const dev = cmd === 'watch' || cmd === 'test';
                if (cmd === 'test' && !platform.hasAny('test'))
                    continue;
                config[preset] = generateConfig(preset, dev, options, {});
                if (options.webpackDll && !platform.hasAny('server')) {
                    config[`${preset}-dll`] = generateConfig(`${preset}-dll`, dev, options, {});
                }
            }
        }
    } catch (e) {
        console.error(e.stack);
    }

    return { config, options };
};

export default createConfig;
