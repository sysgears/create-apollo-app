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
    title: '@server-web: TypeScript, Apollo (GraphQL), Express server, React for web',
    files: getWorkspaceRelFiles(['server', 'web'])
  },
  {
    title: '@server-mobile: TypeScript, Apollo (GraphQL), Express server, React Native for mobile',
    files: getWorkspaceRelFiles(['server', 'mobile'])
  },
  {
    title: '@universal: TypeScript, Apollo (GraphQL), Express server, React for web, React Native for mobile',
    files: getWorkspaceRelFiles(['server', 'web', 'mobile'])
  },
  {
    title: '@server: TypeScript, Apollo (GraphQL), Express server',
    files: getTemplateFilePaths(__dirname + '/../templates/server')
  },
  {
    title: '@web: TypeScript, Apollo (GraphQL), React web app',
    files: getTemplateFilePaths(__dirname + '/../templates/web')
  },
  {
    title: '@mobile: TypeScript, Apollo (GraphQL), React Native for mobile',
    files: getTemplateFilePaths(__dirname + '/../templates/mobile')
  }
];

export default templates;
