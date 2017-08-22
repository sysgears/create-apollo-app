import { Builder } from "./Builder";

export default class Spin
{
    dev: boolean;
    cmd: string;
    builders: { [x: string]: Builder };

    constructor(argv: string[], builders) {
        this.cmd = argv[2];
        this.dev = this.cmd === 'watch' || this.cmd === 'test';
        this.builders = builders;
    }
}