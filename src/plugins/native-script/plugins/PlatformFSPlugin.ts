import minimatch from 'minimatch';
import { basename, join, parse, relative } from 'path';

export default class {
  private platform: any;
  private platforms: any;
  private ignore: any;
  private trimPlatformSuffix: any;
  private isNotAlienPlatformFile: any;
  private context: any;
  private isIgnored: any;
  private alienPlatforms: any;

  constructor({ platform, platforms, ignore }: any) {
    this.platform = platform;
    this.platforms = platforms;
    this.ignore = ignore || [];

    const alienPlatforms = this.platforms.filter(p => p !== platform);
    const alienPlatformFilters = alienPlatforms
      .map((pltfrm: any) => ({
        endsWithSuffix: `.${pltfrm}`,
        contains: `.${pltfrm}.`
      }))
      .map(({ endsWithSuffix, contains }) => baseFileName =>
        baseFileName.endsWith(endsWithSuffix) || baseFileName.indexOf(contains) !== -1
      );
    this.isNotAlienPlatformFile = file => !alienPlatformFilters.some(filter => filter(basename(file)));

    const currentPlatformExt = `.${platform}`;
    this.trimPlatformSuffix = file => {
      const { dir, name, ext } = parse(file);
      if (ext === currentPlatformExt) {
        return join(dir, name);
      } else if (name.endsWith(currentPlatformExt)) {
        return join(dir, name.substr(0, name.length - currentPlatformExt.length) + ext);
      }
      return file;
    };
  }

  public apply = (compiler: any) => {
    const context = (this.context = compiler.context);
    const minimatchFileFilters = this.ignore.map(pattern => {
      const minimatchFilter = minimatch.filter(pattern);
      return file => minimatchFilter(relative(context, file));
    });

    this.isIgnored = file => minimatchFileFilters.some(filter => filter(file));

    compiler.inputFileSystem = this.mapFileSystem(compiler.inputFileSystem);
  };

  public mapFileSystem = (fs: any) => {
    const platform = this.platform;
    const platforms = this.platforms;
    const alienPlatforms = this.alienPlatforms;
    const isNotAlienPlatformFile = this.isNotAlienPlatformFile;
    const trimPlatformSuffix = this.trimPlatformSuffix;
    const isIgnored = this.isIgnored;
    const isNotIgnored = file => !isIgnored(file);

    const mappedFS = {
      get _statStorage() {
        return fs._statStorage;
      },
      get _readFileStorage() {
        return fs._readFileStorage;
      },
      get _readdirStorage() {
        return fs._readdirStorage;
      }
    };

    ['readFile', 'provide', 'stat', 'readJson', 'readlink'].forEach(mapPath);
    ['readdir'].forEach(filterResultingFiles);

    return mappedFS;

    /**
     * For FS functions that get as first argument a file path,
     * this will map it to a platform specific file if such file exists or fallback to the default.
     * Also the last argument must be a function that handles results such as (err, files[]),
     * it will invoke err for files that are ignored.
     */
    function mapPath(fileName: any) {
      const base = fs[fileName];
      const args = arguments;
      mappedFS[fileName] = () => {
        const originalFilePath = args[0];
        const callback = args[args.length - 1];
        if (isIgnored(originalFilePath)) {
          callback(new Error('File ' + originalFilePath + ' is ignored!'));
          return;
        }
        const { dir, name, ext } = parse(originalFilePath);
        const platformFilePath = join(dir, name + ('.' + platform) + ext);
        fs.stat(platformFilePath, (err, stat) => {
          if (!err && stat && stat.isFile()) {
            args[0] = platformFilePath;
          }
          base.apply(fs, args);
        });
      };
    }

    /**
     * For FS functions that get as a last argument a function,
     * that handles results such as (err, files[]),
     * will filter and map the returned files[].
     */
    function filterResultingFiles(fileName: any) {
      const base = fs[fileName];
      const args = arguments;
      mappedFS[fileName] = () => {
        const callback = args[args.length - 1];
        const dir = args[0];
        if (isIgnored(dir)) {
          // Return empty file list for filtered directories.
          callback(null, []);
          return;
        }
        args[args.length - 1] = (err: any, files: any) => {
          if (err) {
            callback(err);
          } else {
            // Create absolute paths for "ignored" testing, map platforms, and return back the base name.
            const result = files
              .map(file => join(dir, file))
              .filter(isNotIgnored)
              .filter(isNotAlienPlatformFile)
              .map(trimPlatformSuffix)
              .map(file => basename(file));

            // app.css and app.android.css will both map into app.css and we remove duplicates:
            const uniqueResults = new Set(result);
            callback(null, uniqueResults);
          }
        };
        base.apply(fs, args);
      };
    }
  };
}
