import * as fs from 'fs';

if (process.argv.length >= 3) {
  const cmd = process.argv[2];
  if (cmd === 'watch') {
    let config;
    if (fs.existsSync('webpack.config.js')) {
      config = require('./webpack.config.js');
    } else {
      config = require('spinjs/webpack.config.js');
    }
    console.log("Watch!", config);
  }
}
