import { chmodSync, createWriteStream, existsSync } from 'fs';
import { get } from 'https';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { mkdir } from 'shelljs';

const CONSTANTS = {
  SNAPSHOT_TMP_DIR: join(tmpdir(), 'snapshot-tools')
};

const createDirectory = dir => mkdir('-p', dir);

const downloadFile = (url, destinationFilePath) =>
  new Promise((resolve: any, reject: any) => {
    const request = get(url, (response: any) => {
      switch (response.statusCode) {
        case 200:
          const file = createWriteStream(destinationFilePath);
          file.on('error', (error: any) => {
            return reject(error);
          });
          file.on('finish', () => {
            file.close();
            chmodSync(destinationFilePath, 755);
            return resolve(destinationFilePath);
          });
          response.pipe(file);
          break;
        case 301:
        case 302:
        case 303:
          const redirectUrl = response.headers.location;
          return this.downloadExecFile(redirectUrl, destinationFilePath);
        default:
          return reject(new Error('Unable to download file at ' + url + '. Status code: ' + response.statusCode));
      }
    });

    request.end();

    request.on('error', (err: any) => {
      return reject(err);
    });
  });

const getJsonFile = (url: any) =>
  new Promise((resolve: any, reject: any) => {
    get(url, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        const data = JSON.parse(body);
        return resolve(data);
      });
    }).on('error', reject);
  });

export { CONSTANTS, createDirectory, downloadFile, getJsonFile };
