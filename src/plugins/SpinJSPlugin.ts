import { Builder } from '../Builder';
import { InitConfig } from '../InitConfig';
import Spin from '../Spin';
import { StackPlugin } from '../StackPlugin';

export default class SpinJSPlugin implements StackPlugin {
  public detect(builder: Builder, spin: Spin): boolean {
    return true;
  }

  public init(builder: Builder, spin: Spin): InitConfig {
    return {
      devDependencies: ['spinjs']
    };
  }
}
