import { Builder } from "./Builder";

export default class Spin
{
    dev: boolean;
    cmd: string;
    builders: { [x: string]: Builder };
    options: any;

    constructor(argv: string[], builders, options) {
        this.cmd = argv[2];
        this.dev = this.cmd === 'watch' || this.cmd === 'test';
        this.builders = builders;
        this.options = options;
    }
}