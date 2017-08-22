import createConfig from './createConfig';
import execute from './executor';

if (process.argv.length >= 3) {
    const cmd = process.argv[2];
    let config;
    if (cmd === 'watch' || cmd === 'build' || cmd === 'test') {
        config = createConfig(cmd);
    }
    execute(cmd, config.builders, config.options);
}
