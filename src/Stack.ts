export default class Stack {
  public technologies: string[];
  public platform: string;

  constructor(...stack) {
    this.technologies = stack.reduce((acc, tech) => {
      if (!tech) {
        return acc;
      } else if (tech.constructor === Array) {
        return acc.concat(tech);
      } else {
        return acc.concat(tech.split(':'));
      }
    }, []);
    if (this.hasAny('server')) {
      this.platform = 'server';
    } else if (this.hasAny('web')) {
      this.platform = 'web';
    } else if (this.hasAny('electron')) {
      this.platform = 'electron';
    } else if (this.hasAny('android')) {
      this.platform = 'android';
    } else if (this.hasAny('ios')) {
      this.platform = 'ios';
    } else {
      throw new Error(`stack should include one of 'server', 'web', 'electron', 'android', 'ios'`);
    }
  }

  public hasAny(technologies): boolean {
    const array = technologies.constructor === Array ? technologies : [technologies];
    for (const feature of array) {
      if (this.technologies.indexOf(feature) >= 0) {
        return true;
      }
    }
    return false;
  }

  public hasAll(technologies): boolean {
    const array = technologies.constructor === Array ? technologies : [technologies];
    for (const feature of array) {
      if (this.technologies.indexOf(feature) < 0) {
        return false;
      }
    }
    return true;
  }
}
