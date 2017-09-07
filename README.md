<p align="center"><a href="#"><img width="150" src="https://rawgit.com/sysgears/spin.js/master/logo.svg"></a></p>

## Spin.js - is a tool that sets up great JavaScript build infrastructure for you

[![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Installation

```bash
npm install -g spinjs
```

## Basic Usage

The idea behind `spin.js` is very simple. You add into your `package.json` the property `spin` that describes your stack:
```json
{
  "spin": "webpack:es6:apollo:react:styled-components:sass:server"
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

## Concepts


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
