#!/bin/sh
":" //# comment; exec /usr/bin/env node --preserve-symlinks "$0" "$@"
require('source-map-support').install();

require('./lib/cli');
