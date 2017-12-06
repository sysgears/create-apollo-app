"use strict";

const hook = require("nativescript-hook")(__dirname);
hook.postinstall();

const installer = require("./lib/installer");
installer.install();