import { camelize } from 'humps';

const webpackHook = (hookType: string, compiler: any, hookName: string, hookFunc: (...args: any[]) => any): void => {
  if (compiler.hooks) {
    const hook = compiler.hooks[camelize(hookName)];
    if (hookType === 'async') {
      hook.tapAsync('SpinJS', hookFunc);
    } else {
      hook.tap('SpinJS', hookFunc);
    }
  } else {
    compiler.plugin(hookName, hookFunc);
  }
};

export const hookSync = (compiler: any, hookName: string, hookFunc: (...args: any[]) => any): void =>
  webpackHook('sync', compiler, hookName, hookFunc);

export const hookAsync = (compiler: any, hookName: string, hookFunc: (...args: any[]) => any): void =>
  webpackHook('async', compiler, hookName, hookFunc);
