import * as path from 'path';

export default (rootPath: string, relPath: string = '.'): string[] => {
  const paths = [];
  let curDir = rootPath;
  while (true) {
    const lastIdx = curDir.lastIndexOf(path.sep, curDir.length - 1);
    paths.push(path.join(curDir + (lastIdx < 0 ? path.sep : ''), relPath));
    if (lastIdx < 0) {
      break;
    }
    curDir = curDir.substring(0, lastIdx);
  }

  return paths;
};
