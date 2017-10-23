export interface VirtualFS {
  [path: string]: any;
}

export interface InitConfig {
  fs?: VirtualFS;
  dependencies?: string[];
  devDependencies?: string[];
}
