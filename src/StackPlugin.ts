import { InitConfig } from './InitConfig';
import Spin from './Spin';

export interface StackPlugin {
  detect(builder, spin: Spin): boolean;
  init?(builder, spin: Spin): InitConfig;
  configure?(builder, spin: Spin);
}
