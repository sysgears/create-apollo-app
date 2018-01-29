import { RequireFunction } from './createRequire';
import Stack from './Stack';

export interface Builder {
  name: string;
  require: RequireFunction;
  enabled: boolean;
  stack: Stack;
  roles: string[];
  parent?: Builder;
  child?: Builder;
  config?: any;
  [x: string]: any;
}

export interface Builders {
  [id: string]: Builder;
}
