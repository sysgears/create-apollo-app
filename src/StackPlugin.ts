import { Dependencies } from './Dependencies';
import Spin from './Spin';

export interface StackPlugin {
  detect(builder, spin: Spin): boolean;
  init?(builder, spin: Spin): Dependencies;
  configure?(builder, spin: Spin);
}
