import * as fs from 'fs';

if (process.argv.length >= 3) {
  const cmd = process.argv[2];
  if (cmd === 'watch' || cmd === 'build' || cmd === 'test') {
    let createConfig;
    if (fs.existsSync('spin.config.js')) {
      createConfig = require('./spin.config.js').default;
    } else {
      createConfig = require('spinjs/spin.config.js').default;
    }
    const config = createConfig(cmd);
    console.log(`'${cmd}' config: ${config}`);
  }
}
