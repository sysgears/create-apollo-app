import { parse } from 'path';

export default class {
  private platform: any;
  private platforms: any;

  constructor(platform: any, platforms: any) {
    this.platform = platform;
    this.platforms = platforms || ['ios', 'android'];
  }

  public apply = (resolver: any) => {
    const platform = this.platform;
    const platforms = this.platforms;

    resolver.plugin('file', function(request, callback) {
      const fs = this.fileSystem;
      const file = this.join(request.path, request.request);
      const query = request.query;
      const pFile = parse(file);
      const platformFile = this.join(pFile.dir, pFile.name + ('.' + platform) + pFile.ext);
      fs.stat(platformFile, (err, st) => {
        if (!err && st && st.isFile()) {
          const error = undefined;
          const path = platformFile;
          callback(error, { file: true, path, query });
        } else {
          fs.stat(file, (err1: any, st1: any) => {
            if (!err1 && st1 && st1.isFile()) {
              const error = undefined;
              const path = file;
              callback(error, { file: true, path, query });
            } else {
              callback();
            }
          });
        }
      });
    });
  };
}
