<p align="center"><a href="#"><img width="150" src="https://rawgit.com/sysgears/spin.js/master/logo.svg"></a></p>

## Spin.js - is a tool that sets up great JavaScript build infrastructure for you

[![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Installation

```bash
npm install -g spinjs
```

## Basic Usage

The idea behind `spin.js` is simple: you describe the stack used in your application in the property `spin` of `package.json`:
```json
{
  "spin": "webpack:es6:apollo:react-native:ios"
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

## Supported technologies stack

At the moment `spin.js` supports the following technologies, that can be specified inside `stack` property:

|Technology                |Description|
|--------------------------|-----------|
|webpack|Webpack|
|es6|Code transpiled from the ECMAScript 6 to ECMAScript 5|
|react|React|
|react-native|React Native|
|react-hot-loader|Use React Hot Loader during development|
|styled-components|Styled Components|
|sass|SCSS stylesheets transpiled to CSS|
|less|LESS stylesheets transpiled to CSS|
|apollo|Apollo GraphQL|
|server|The code is targeted to run under Node.js|
|web|The code is targeted to run in Web Browser|
|ios|The code is targeted to run on iOS device|
|android|The code is targeted to run on Android device|

## Concepts

`spin.js` configures and launches multiple builders in parallel to build the project. If stack for the project is specified
in `spin` property of `package.json`, then only one builder is launched. To specify multiple builders the following 
configuration should be used:
```json
{
    "spin": {
        "builders": {
            "backend": {
                "stack": "webpack:es6:apollo:react:styled-components:sass:server"
            },
            "frontend": {
                "stack": "webpack:es6:apollo:react:styled-components:sass:web"    
            },
            "mobile": {
                "stack": "webpack:es6:apollo:react-native:styled-components:sass:ios"        
            }
        }
    }
}
```

The 'spin.js' configuration can be specified in `.spinrc.json` instead of `package.json`, it should contain the value of 
`spin` property in this case.

Each builder has a name and a `stack` property at minimum. Builder properties recognized by `spin.js`:

|Builder Option            |Description|
|--------------------------|-----------|
|stack|an array or semicolon separated string with list of stack features for the builder|
|enabled|whether this builder is enabled, `true` by default|
|roles|what are the roles of the builder, allowed values: `build`, `watch`, `test`, `["build", "watch"]` by default| 
|webpackDevPort|the local port used for Webpack Dev Server process to host web frontend files|

Builder can also have builder-specific options, depending on its stack, recognized by `spin.js` plugins.

Options that are non-specific to each builder but rather to application as a whole can be specified in 
`options` property on the same level as `builders` property. Supported options:

|General Option            |Description|
|--------------------------|-----------|
|plugins|Additional `spin.js` plugins module names|
|backendBuildDir|Output directory for code targeted to run under Node.js|
|frontendBuildDir|Output directory for code targeted to run in Web Browser and on mobile devices| 
|dllBuildDir|Output directory for Webpack DLL files used to speed up incremental builds|
|backendUrl|URL to a REST/GraphQL API of the application endpoint|
|ssr|Use server side rendering for the application (makes requiring web assets inside server code possible)| 
|webpackDll|Utilize Webpack DLLs to speed up incremental builds|
|frontendRefreshOnBackendChange|Trigger web frontend refresh when backend code changes|
|persistGraphQL|Generate and use Apollo persistent GraphQL queries|

Each `spin.js` plugin tries to handle subset of technologies in the builder stack to configure build tools 
usually used for this stack the best way. After configuration of the builder it gets executed in the mode
that specified in `spin` command line, i.e. `watch`, `build`, `test`, etc. 

There are several built-in plugins supplied with `spin.js`. External plugins can be specified inside
`options -> plugins` property.

## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars1.githubusercontent.com/u/1259926?v=3" width="100px;"/><br /><sub>Victor Vlasenko</sub>](https://ua.linkedin.com/in/victorvlasenko)<br />[💻](https://github.com/sysgears/spin.js/commits?author=vlasenko "Code") [🔧](#tool-vlasenko "Tools") [📖](https://github.com/sysgears/spin.js/commits?author=vlasenko "Documentation") [⚠️](https://github.com/sysgears/spin.js/commits?author=vlasenko "Tests") [💬](#question-vlasenko "Answering Questions") [👀](#review-vlasenko "Reviewed Pull Requests") |
| :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!

## License
Copyright © 2017 [SysGears INC]. This source code is licensed under the [MIT] license.

[MIT]: LICENSE
[SysGears INC]: http://sysgears.com
