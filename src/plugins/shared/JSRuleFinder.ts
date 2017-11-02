import { Builder } from '../../Builder';

export default class JSRuleFinder {
  public builder: Builder;

  public jsRule: any;
  public tsRule: any;

  constructor(builder: Builder) {
    this.builder = builder;
  }

  public findJSRule(): any {
    if (!this.jsRule) {
      const jsCandidates = ['/\\.js$/', '/\\.jsx?$/'];

      for (const rule of this.builder.config.module.rules) {
        if (jsCandidates.indexOf(String(rule.test)) >= 0) {
          this.jsRule = rule;
          break;
        }
      }
    }

    return this.jsRule;
  }

  public createJSRule() {
    if (this.jsRule) {
      throw new Error('js rule already exists!');
    }
    this.jsRule = { test: /\.js$/ };
    this.builder.config.module.rules = this.builder.config.module.rules.concat(this.jsRule);
    return this.jsRule;
  }

  public findAndCreateJSRule(): any {
    return this.findJSRule() || this.createJSRule();
  }

  public findTSRule(): any {
    if (!this.tsRule) {
      const jsCandidates = ['/\\.ts$/', '/\\.tsx?$/'];

      for (const rule of this.builder.config.module.rules) {
        if (jsCandidates.indexOf(String(rule.test)) >= 0) {
          this.tsRule = rule;
          break;
        }
      }
    }

    return this.tsRule;
  }

  public createTSRule() {
    if (this.tsRule) {
      throw new Error('ts rule already exists!');
    }
    this.tsRule = { test: /\.ts$/ };
    this.builder.config.module.rules = this.builder.config.module.rules.concat(this.tsRule);
    return this.tsRule;
  }

  public findAndCreateTSRule(): any {
    return this.findTSRule() || this.createTSRule();
  }

  get extensions(): string[] {
    const result = [];

    const jsTestStr = String(this.jsRule ? this.jsRule.test : 'js');
    const tsTestStr = String(this.tsRule ? this.tsRule.test : '');

    if (tsTestStr.indexOf('tsx') >= 0) {
      result.push('tsx');
    }
    if (jsTestStr.indexOf('jsx') >= 0) {
      result.push('jsx');
    }
    if (tsTestStr.indexOf('ts') >= 0) {
      result.push('ts');
    }
    if (jsTestStr.indexOf('js') >= 0) {
      result.push('js');
    }
    return result;
  }
}
