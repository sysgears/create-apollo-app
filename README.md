# Create Apollo App

[![npm version](https://badge.fury.io/js/create-apollo-app.svg)](https://badge.fury.io/js/create-apollo-app)
[![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Description

Create Apollo App is a command-line tool that generates a fully configured starter Apollo (GraphQL) project with only
essential dependencies. With Create Apollo App, you can start developing a client, server, or mobile app, or a
universal application in no time.

The projects generated with Create Apollo App are built of familiar technologies from the JavaScript ecosystem:
TypeScript, Webpack, React, Express, and React Native. Depending on the type of the project you want to develop, the
mentioned technologies are used in different combinations to provide particular setups for server, client, or mobile
development.

Create Apollo App relieves you from the pain of installing and configuring an Apollo project while making it easy to
change project configurations if necessary.

## Generating a Project with Create Apollo App

### Prerequisites

Install the following dependencies:

* Node.js 6.x or higher (Node.js 8.x is recommended)
* NPM or Yarn to manage JavaScript packages and run scripts

Besides the dependencies for Node.js, you may also need to install and set up additional tools for mobile development:

* iOS Simulator or Android emulation software
* [Xcode](https://developer.apple.com/xcode/) (optional; an IDE for iOS development)
* [Android Studio](https://developer.android.com/studio/) (optional; an IDE for Android development)

Installing [Expo Client](https://expo.io/tools#client) is also optional. If you set up iOS Simulator or a similar tool,
Create Apollo App will automatically download Expo Client if it's not installed.

### Generating a Project

Start a new project with Create Apollo App using the following command (the default NPM utility is used):

```bash
npx create-apollo-app new-apollo-app
```

If you’re using Yarn, run:

```bash
yarn create apollo-app my-app
```

> `yarn create` will automatically prefix `apollo-app` with `create-`. For more information, you can consult this [blog
post on Yarn](https://yarnpkg.com/blog/2017/05/12/introducing-yarn/).

From this point onward, we'll use Yarn in our examples for running the project.

During installation, the terminal will prompt the following six options:

```
❯ @server-web: Apollo GraphQL Node Express server and web frontend in TypeScript
  @server-mobile: Apollo GraphQL Node Express server and React Native mobile frontend in TypeScript
  @universal: Apollo GraphQL Node Express server, React web frontend and React Native mobile frontend in TypeScript
  @server: Apollo GraphQL Node Express server in TypeScript
  @web: Apollo GraphQL React web frontend in TypeScript
  @mobile: Apollo GraphQL React Native mobile frontend in TypeScript
```

You can select the necessary project template using the arrow keys on your keyboard. Alternatively, you can start typing
the name of the template to filter the list.

You can also specify the name of the template by attaching the `@name_of_the_template` after the project name, for
example:

```bash
yarn create apollo-app my-app@web
```

If you run the command above, Create Apollo App will create a `my-app/` project directory with the `@web` template meaning
the client-side Apollo app. Similarly, add `@server-web`, `@universal`, or other template name instead of `@web` to 
choose a particular template.

> Consult [the Apollo Project Templates section](#apollo-project-templates) to know what templates are currently
available.

Select the first (default) option `@server-web` from the list and press Enter. Create Apollo App will generate a
client-server application.

Note that it may take a while (usually up to a minute) for all dependencies to be installed and for the project to be
configured. The terminal will confirm when the project is ready.

#### Running the Project in Development Mode

Once the installation is complete, run:

```bash
cd my-app
yarn start
```

A development build will be generated. You can start changing the source code in the project files located in the
`packages/server/src/` and `packages/web/src/` directories.

The client-side application will be automatically opened in your default browser at [http://localhost:3000](http://localhost:3000).
The server-side GraphQL application runs on [http://localhost:8080](http://localhost:8080).

If you installed a template for mobile development, the React Native app will be opened at [http://localhost:3020](http://localhost:3020)
for iOS and at [http://localhost:3010](http://localhost:3010) for Android.  

#### Generating the Production-Ready Code

If you want to build a production version of the app (i.e., the code will be minified), run:

```bash
yarn build
```

The production-ready code will be saved to `packages/server/build/` and `packages/web/build/` directories for
server-side and client-side code respectively.

### Apollo Project Templates

Create Apollo App provides you with the default configurations for different kinds of projects. For example, if you need
to build only a client-side application, you can select a respective template &ndash; `@web` &ndash; during installation.

Overall, you can choose one of the six templates:

* `@web` for a client-side application.
* `@server` for a server-side application.
* `@mobile` for a mobile application.
* `@server-web` &ndash; (default) a complete solution for building a client-server app.
* `@server-mobile` &ndash; a complete solution for building a server-side app and mobile front end.
* `@universal` &ndash; the most comprehensive solution for building an app for the client, server, and mobile.

### Project Structure

We'll review the structure of the `@universal` project, meaning it will have the `client/`, `server/`, and `mobile/`
packages under the `packages/` directory. The `@server-web` template that you installed comes without the mobile package.

Here's an overview of the `@universal` project structure:

```
my-apollo-app
├── node_modules/
├── packages/
    ├── mobile
        ├── node_modules/
        ├── src/
            ├── App.tsx
            ├── AwakeInDevApp.js
            └── index.ts
        ├── typings/
        ├── app.json
        ├── package.json
        ├── tsconfig.json
        └── tslint.json        
    ├── server/
        ├── node_modules/
        ├── src/
            ├── index.ts
            ├── resolvers.ts
            ├── schema.graphql
            ├── schema.ts
            └── server.ts
        ├── typings/
        ├── package.json
        ├── tsconfig.json
        └── tslint.json
    └── web/
        ├── src/
            ├── App.tsx
            └── index.tsx
        ├── typings/
        ├── package.json
        ├── tsconfig.json
        └── tslint.json
├── .gitignore
├── package.json
├── tsconfig.json
├── tslint.json
└── yarn.lock
```

You'll work with the files located in `packages/mobile/src/`, `packages/server/src`, and `packages/web/src/` when working
on your Apollo project. In those directories, you can view the default project files, which you may freely change or
delete.

## License

Copyright © 2018 [SysGears Limited]. This source code is licensed under the [MIT] license.

[MIT]: LICENSE
[SysGears Limited]: http://sysgears.com
