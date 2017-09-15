import { Builder } from "../../Builder";

export default class JSRuleFinder {
    rule: any;

    constructor(builder: Builder) {
        const jsCandidates = [String(/\.js$/), String(/\.jsx?$/), String(/\.ts$/), String(/\.tsx?$/)];
        for (let rule of builder.config.module.rules) {
            if (jsCandidates.indexOf(String(rule.test)) >= 0) {
                this.rule = rule;
                break;
            }
        }
        if (!this.rule) {
            this.rule = { test: /\.js$/ };
            builder.config.module.rules = builder.config.module.rules.concat(this.rule);
        }
    }

    get extensions(): Array<string> {
        const testStr = String(this.rule.test);
        if (testStr.indexOf('jsx') >= 0) {
            return ['jsx', 'js'];
        } else if (testStr.indexOf('js') >= 0) {
            return ['js'];
        } else if (testStr.indexOf('tsx') >= 0) {
            return ['tsx', 'ts'];
        } else if (testStr.indexOf('ts') >= 0) {
            return ['ts'];
        }
    }
}
