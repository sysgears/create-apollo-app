import Spin from './Spin';

export interface ConfigPlugin {
  configure(builder, spin: Spin);
}
