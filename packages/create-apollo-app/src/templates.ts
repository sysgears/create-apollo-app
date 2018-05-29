import { getRelFilePaths, Template } from '@jsapp/creator';

const templates: Template[] = [
  /*  {
    title: '@server-web: Apollo GraphQL Node Express server and web frontend in TypeScript',
    workspaces: true,
    filesRoot,
    files: []
  },
  {
    title: '@server-mobile: Apollo GraphQL Node Express server and React Native mobile frontend in TypeScript',
    workspaces: true,
    filesRoot,
    files: []
  },
  {
    title:
      '@universal: Apollo GraphQL Node Express server, React web frontend and React Native mobile frontend in TypeScript',
    workspaces: true,
    filesRoot,
    files: []
  }, */
  {
    title: '@server: Apollo GraphQL Node Express server in TypeScript',
    files: getRelFilePaths(__dirname + '/../templates/server')
  },
  {
    title: '@web: Apollo GraphQL React web frontend in TypeScript',
    files: getRelFilePaths(__dirname + '/../templates/web')
  } /*,
  {
    title: '@mobile: Apollo GraphQL React Native mobile frontend in TypeScript',
    filesRoot,
    files: []
  } */
];

export default templates;
