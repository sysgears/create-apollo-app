import * as merge from 'webpack-merge';
import { Builder } from './Builder';
import { Configuration } from "webpack";

export default class Spin
{
    dev: boolean;
    test: boolean;
    cmd: string;
    builders: { [x: string]: Builder };
    options: any;
    depPlatforms: any;

    constructor(argv: string[], builders, options, depPlatforms) {
        this.cmd = argv[2];
        this.dev = this.cmd === 'watch' || this.cmd === 'test';
        this.test = this.cmd === 'test';
        this.builders = builders;
        this.options = options;
        this.depPlatforms = depPlatforms;
    }

    merge(config: Configuration, overrides: any): Configuration {
        return merge.smart(config, overrides);
    }
}