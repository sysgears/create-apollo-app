import * as fs from 'fs';
import * as path from 'path';
import { fromStringWithSourceMap, SourceListMap } from 'source-list-map';
import { RawSource } from 'webpack-sources';

export default class VendorDllFilesFetcher {
  private readonly baseName: string = `vendor_${this.platform}`;

  private vendorDllJsonCache: VendorManifestJson | undefined = undefined;
  public get vendorDllJson(): VendorManifestJson {
    const pathToManifest = path.join(this.dllBuildDir, `${this.baseName}_dll.json`);
    return (
      this.vendorDllJsonCache ||
      (this.vendorDllJsonCache = {
        path: pathToManifest,
        source: JSON.parse(fs.readFileSync(pathToManifest).toString())
      })
    );
  }

  private vendorHashesJsonCache: VendorManifestJson | undefined = undefined;
  public get vendorHashesJson(): VendorManifestJson {
    const pathToManifest = path.join(this.dllBuildDir, `${this.baseName}_dll_hashes.json`);
    return (
      this.vendorHashesJsonCache ||
      (this.vendorHashesJsonCache = {
        path: pathToManifest,
        source: JSON.parse(fs.readFileSync(pathToManifest).toString())
      })
    );
  }

  private vendorBundleCache: VendorBundle | undefined = undefined;
  public get vendorBundle(): VendorBundle {
    const pathToBundle: string = path.join(this.dllBuildDir, this.vendorHashesJson.source.name);
    return (
      this.vendorBundleCache ||
      (this.vendorBundleCache = {
        source: new RawSource(fs.readFileSync(pathToBundle).toString()),
        sourceMap: new RawSource(fs.readFileSync(`${pathToBundle}.map`).toString())
      })
    );
  }

  private vendorAssetsCache: string | undefined = undefined;
  public get vendorAssets(): string {
    const pathToAssets: string = path.join(this.dllBuildDir, `${this.vendorHashesJson.source.name}.assets`);
    return this.vendorAssetsCache || (this.vendorAssetsCache = JSON.parse(fs.readFileSync(pathToAssets).toString()));
  }

  private vendorSourceListMapCache: SourceListMap | undefined = undefined;
  public get vendorSourceListMap(): SourceListMap {
    return (
      this.vendorSourceListMapCache ||
      (this.vendorSourceListMapCache = fromStringWithSourceMap(
        this.vendorBundle.source.source(),
        JSON.parse(this.vendorBundle.sourceMap.source())
      ))
    );
  }

  constructor(private dllBuildDir: string, private platform: string) {}
}

export interface VendorManifestJson {
  path: string;
  source: any;
}

export interface VendorBundle {
  source: RawSource;
  sourceMap: RawSource;
}
