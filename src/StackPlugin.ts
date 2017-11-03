import { Builder } from './Builder';
import { InitConfig } from './InitConfig';
import Spin from './Spin';

export interface StackPlugin {
  detect(builder: Builder, spin: Spin): boolean;
  init?(builder: Builder, spin: Spin): InitConfig;
  configure?(builder: Builder, spin: Spin);
}
