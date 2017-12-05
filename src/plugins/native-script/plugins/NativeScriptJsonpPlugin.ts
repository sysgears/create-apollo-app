import { ConcatSource } from 'webpack-sources';

const WINDOWS_GLOBAL_MATCHER = /window\["nativescriptJsonp"\]/g;
const NATIVESCRIPT_GLOBAL = 'global["nativescriptJsonp"]';
const isVendorChunk = name => name === 'vendor.js';

// HACK: changes the JSONP chunk eval function to `global["nativescriptJsonp"]`
// applied to tns-java-classes.js only
export class NativeScriptJsonpPlugin {
  constructor() {}

  public apply = (compiler: any) => {
    compiler.plugin('compilation', function(compilation) {
      compilation.plugin('optimize-chunk-assets', (chunks: any, callback: any) => {
        chunks.forEach((chunk: any) => {
          chunk.files.filter(isVendorChunk).forEach(file => this.replaceGlobal(compilation.assets, file));
        });
        callback();
      });
    });
  };

  private replaceGlobal = (assets: any, file: any) => {
    const path = assets[file];
    const source = path.source();
    const match = source.match(WINDOWS_GLOBAL_MATCHER);

    if (match) {
      const newSource = source.replace(WINDOWS_GLOBAL_MATCHER, NATIVESCRIPT_GLOBAL);
      assets[file] = new ConcatSource(newSource);
    }
  };
}
