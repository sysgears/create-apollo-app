import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class SpinJSPlugin implements StackPlugin {
  public detect(builder, spin: Spin): boolean {
    return true;
  }

  public init(builder: any, spin: Spin): InitConfig {
    return {
      devDependencies: ['spinjs']
    };
  }

  public configure(builder: Builder, spin: Spin) {}
}
