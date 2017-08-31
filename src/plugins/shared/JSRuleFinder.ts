import { Builder } from "../../Builder";

export default function(builder: Builder): any {
    let jsRule;
    for (let rule of builder.config.module.rules) {
        if (String(rule.test) === String(/\.jsx?$/)
            || String(rule.test) === String(/\.js$/)) {
            jsRule = rule;
            break;
        }
    }
    if (!jsRule) {
        jsRule = { test: /\.js$/ };
        builder.config.module.rules = builder.config.module.rules.concat(jsRule);
    }

    return jsRule;
}