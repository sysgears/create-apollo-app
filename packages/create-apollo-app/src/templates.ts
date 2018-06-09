import { DirRoots, getTemplateFilePaths, Template, TemplateFilePaths } from '@jsapp/creator';

const getWorkspaceRelFiles = (packages: string[]): TemplateFilePaths =>
  getTemplateFilePaths(
    ([{ srcRoot: __dirname + '/../templates/workspace', dstRoot: '.' }] as DirRoots[]).concat(
      packages.map(name => ({
        srcRoot: __dirname + '/../templates/' + name,
        dstRoot: 'packages/' + name
      }))
    )
  );

const templates: Template[] = [
  {
    title: '@server-web: Apollo GraphQL Node Express server and web frontend in TypeScript',
    files: getWorkspaceRelFiles(['server', 'web'])
  },
  {
    title: '@server-mobile: Apollo GraphQL Node Express server and React Native mobile frontend in TypeScript',
    files: getWorkspaceRelFiles(['server', 'mobile'])
  },
  {
    title:
      '@universal: Apollo GraphQL Node Express server, React web frontend and React Native mobile frontend in TypeScript',
    files: getWorkspaceRelFiles(['server', 'web', 'mobile'])
  },
  {
    title: '@server: Apollo GraphQL Node Express server in TypeScript',
    files: getTemplateFilePaths(__dirname + '/../templates/server')
  },
  {
    title: '@web: Apollo GraphQL React web frontend in TypeScript',
    files: getTemplateFilePaths(__dirname + '/../templates/web')
  },
  {
    title: '@mobile: Apollo GraphQL React Native mobile frontend in TypeScript',
    files: getTemplateFilePaths(__dirname + '/../templates/mobile')
  }
];

export default templates;
