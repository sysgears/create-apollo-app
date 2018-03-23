<p align="center"><a href="#"><img width="150" src="https://rawgit.com/sysgears/spinjs/master/logo.svg"></a></p>

## spinjs - the best build tool - is the one that don't need build rules

[![Join the chat at https://gitter.im/sysgears/spinjs](https://badges.gitter.im/sysgears/spinjs.svg)](https://gitter.im/sysgears/spinjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![npm version](https://badge.fury.io/js/spinjs.svg)](https://badge.fury.io/js/spinjs) [![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Installation

```bash
npm install -g spinjs
```

## Motivation

> `spinjs` was created to free the developer from build rules writing for JavaScript projects as much as possible.
> Its difference from many other build tools with similair goals is that `spinjs` is not tied to specific framework
> and does not attempt to lock you out from generated config. `spinjs` does its best to provide you with very mature
> build setup from the minimal information provided by you about your tech stack and lets you further customize
> every aspect of build setup when needed.

## Basic Usage

The basic `spinjs` usage is simple: you describe the stack used in your application in the property `spin` of `package.json`:
```json
{
  "spin": "webpack:babel:apollo:react-native:ios"
}
```
and you are all set.

You can then execute
```bash
spin watch
```
to launch your project in `webpack watch` mode for development. After making changes to your code, they will be
automatically reloaded from disk using Webpack Hot Module Replacement.

```bash
spin build
```
will build your project for production environment.

```bash
spin test "src/**/*.spec.js"
```
will run tests located in `.spec.js` files via Mocha Webpack.

To see generated Webpack config add `-v` option to any of the above commands, e.g.:
``` bash
spin -v watch
```
will launch project in development mode and will dump generated Webpack config in a terminal.

## Supported technologies stack

At the moment `spinjs` supports the following technologies, that can be specified inside `stack` property:

|Technology                |Description|
|--------------------------|-----------|
|webpack|Webpack|
|babel|Transpile code from the ECMAScript 6 to ECMAScript 5|
|ts|Transpile code from TypeScript to ECMAScript 5|
|vue|Vue.js|
|angular|Angular 4|
|react|React|
|react-native|React Native with Expo|
|react-hot-loader|Use React Hot Loader during development|
|styled-components|Styled Components|
|css|CSS stylesheets|
|sass|SCSS stylesheets transpiled to CSS|
|less|LESS stylesheets transpiled to CSS|
|apollo|Apollo GraphQL|
|server|The code is targeted to run under Node.js|
|web|The code is targeted to run in Web Browser|
|ios|The code is targeted to run on iOS device|
|android|The code is targeted to run on Android device|

## Concepts

`spinjs` configures and launches multiple builders in parallel to build the project. If stack for the project is specified
in `spin` property of `package.json`, then only one builder is launched. To specify multiple builders the following
configuration should be used:
```json
{
    "spin": {
        "builders": {
            "backend": {
                "stack": "webpack:babel:apollo:react:styled-components:sass:server"
            },
            "frontend": {
                "stack": "webpack:babel:apollo:react:styled-components:sass:web"
            },
            "mobile": {
                "stack": "webpack:babel:apollo:react-native:styled-components:sass:ios"
            }
        }
    }
}
```

The 'spinjs' configuration can be specified in `.spinrc.json` instead of `package.json`, it should contain the value of
`spin` property in this case. The object with config can be also exported from `.spinrc.js`

Each builder has a name and a `stack` property at minimum. Builder properties recognized by `spinjs`:

|Builder Option            |Description|
|--------------------------|-----------|
|stack|an array or semicolon separated string with list of stack features for the builder|
|plugins|Additional `spinjs` plugins module names|
|entry|path to entry source file for this builder (`src/{platform}/index.{js,jsx,ts,tsx}` by default)|
|enabled|whether this builder is enabled, `true` by default|
|roles|what are the roles of the builder, allowed values: `build`, `watch`, `test`, `["build", "watch"]` by default|
|defines|assignments that will be available at compile time to all generated code|
|backendUrl|URL to a REST/GraphQL API of the application endpoint(http://localhost:8080 by default) - deprecated use `defines` and `waitOn` instead|
|waitOn|URL in `wait-on` npm package format to await for before emitting compiled code. This is useful for example to force front-end wait until back-end will be compiled and started first in dev mode|
|webpackDevPort|the local port used for Webpack Dev Server process to host web frontend files|
|buildDir|Output directory for built code|
|backendBuildDir|Output directory for code targeted to run under Node.js (deprecated, use buildDir instead)|
|frontendBuildDir|Output directory for code targeted to run in Web Browser and on mobile devices (deprecated, use buildDir instead)|
|dllBuildDir|Output directory for Webpack DLL files used to speed up incremental builds|
|backendUrl|Same as corresponding builder option|
|stack|Same as corresponding builder option, but prepended to each builder stack|
|ssr|Use server side rendering for the application (makes requiring web assets inside server code possible)|
|webpackDll|Utilize Webpack DLLs to speed up incremental builds (default `true`)|
|sourceMap|Generate source maps for output code (default `true`)|
|cache|One of `true`, `false`, `'auto'`, `'auto'` enables Babel and other caching only during development, `true` enables caching for production builds too, `false` disables caching (default: `'auto'`)|
|frontendRefreshOnBackendChange|Trigger web frontend refresh when backend code changes|
|persistGraphQL|Generate and use Apollo persistent GraphQL queries|
|devProxy|Proxy all unknown requests from front-end running on Webpack during development to back-end|
|webpackConfig|Additional webpack config definitions merged in after config generation|
|babelConfig|Additional babelrc definitions merged in after config generation|
|writeStats|Write `stats.json` to disk, default: `false`|
|nodeDebugger|To enable or disable node debugger, default: `true`|

Common builder options can be put into `options` property, from there they will be copied into each builder. `stack` property inside `options` will be prepended to each builder stack.
Builder can also have builder-specific options, depending on its stack, recognized by `spinjs` plugins.

Each `spinjs` plugin tries to handle subset of technologies in the builder stack to configure build tools
usually used for this stack the best way. After configuration of the builder it gets executed in the mode
that specified in `spin` command line, i.e. `watch`, `build`, `test`, etc.

There are several built-in plugins supplied with `spinjs`. External plugins can be specified inside
`options -> plugins` property.

#### Webpack, Babel and other tool-specific config merging

`spinjs` generates configs for various tools based on the stack specified, but sometimes you want to tweak generated configs. For this purpose you can provide `webpackConfig`, `babelConfig`, etc keys to each builder or into `options` if you want tweaking happen for each builder in config.

The values provided in these keys will be merged with config generated by `spinjs` with `webpack-merge`. You should check the result of this merging by running `spinjs` with `-v` option to show resulting configs, example:
`npx spin -v watch`

Though `webpack-merge` uses smart strategy to merge generated configs and the configs provided by you, but it is not smart enough in many cases and you need to configure merge strategy too, to get desirable results. For this purpose you should specify `merge` field
inside `webpackConfig`, `babelConfig` etc, with strategy used by `webpack-merge`.
Example:
```
const config = {
  ...,
  options: {
    babelConfig:
    {
       merge: { presets: 'replace' },
       presets: [
         ["babel-preset-env", {modules: 'commonjs'}],
         "react",
         "stage-0"
       ],
    }
  }
}
```

See `webpack-merge` strategies documentation [here](https://github.com/survivejs/webpack-merge#merging-with-strategies)

#### Current working directory
When reading `.spinrc.js` configs `spinjs` does so recursively in all the child directories. When config in each such directory is being read or builder get executed, process current working directory is set to point to this same directory. This
scheme of operation should be compatible to all 3rd party tools.

### Community support

- [Gitter channel] - questions, answers, general discussions
- [GitHub issues] - submit issues, send feature requests

### Commercial support

[SysGears](https://sysgears.com) team provides advanced support for commercial partners. A commercial partner will have a premium access to our team whether this is to help you with your code based on this project or related technologies used in it. Contact us using [Skype](http://hatscripts.com/addskype?sysgears) or via email: [info@sysgears.com](mailto:info@sysgears.com)

## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars1.githubusercontent.com/u/1259926?v=3" width="100px;"/><br /><sub>Victor Vlasenko</sub>](https://ua.linkedin.com/in/victorvlasenko)<br />[💻](https://github.com/sysgears/spin.js/commits?author=vlasenko "Code") [🔧](#tool-vlasenko "Tools") [📖](https://github.com/sysgears/spin.js/commits?author=vlasenko "Documentation") [⚠️](https://github.com/sysgears/spin.js/commits?author=vlasenko "Tests") [💬](#question-vlasenko "Answering Questions") [👀](#review-vlasenko "Reviewed Pull Requests") | [<img src="https://avatars0.githubusercontent.com/u/4072250?v=3" width="100px;"/><br /><sub>Ujjwal</sub>](https://github.com/mairh)<br />[💻](https://github.com/sysgears/spin.js/commits?author=mairh "Code") [🔧](#tool-mairh "Tools") [📖](https://github.com/sysgears/spin.js/commits?author=mairh "Documentation") [⚠️](https://github.com/sysgears/spin.js/commits?author=mairh "Tests") [💬](#question-mairh "Answering Questions") [👀](#review-mairh "Reviewed Pull Requests") | [<img src="https://avatars1.githubusercontent.com/u/20957416?v=4" width="100px;"/><br /><sub>cdmbase</sub>](https://github.com/cdmbase)<br />[💻](https://github.com/sysgears/spin.js/commits?author=cdmbase "Code") |
| :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!

## License
Copyright © 2017 [SysGears INC]. This source code is licensed under the [MIT] license.

[MIT]: LICENSE
[SysGears INC]: http://sysgears.com
[Gitter channel]: https://gitter.im/sysgears/spinjs
[GitHub issues]: https://github.com/sysgears/spinjs/issues
