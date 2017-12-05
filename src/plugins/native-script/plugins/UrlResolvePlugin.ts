import { existsSync } from 'fs';
import { resolve } from 'path';
import { forEachChild, SyntaxKind } from 'typescript';

export default class {
  private platform: any;
  private resolveStylesUrls: any;
  private resolveTemplateUrl: any;
  private currentDirectory: any;

  constructor(options: any) {
    if (!options || !options.platform) {
      throw new Error(`Target platform must be specified!`);
    }

    this.platform = options.platform;

    // these are true by default
    this.resolveStylesUrls = options.resolveStylesUrls === undefined || options.resolveStylesUrls;
    this.resolveTemplateUrl = options.resolveTemplateUrl === undefined || options.resolveTemplateUrl;

    if (!this.resolveStylesUrls && !this.resolveTemplateUrl) {
      throw new Error(`resolveStylesUrls and resolveTemplateUrl mustn't both be false`);
    }
  }

  public apply = (compiler: any) => {
    compiler.plugin('make', (compilation, callback) => {
      const aotPlugin = this.getAotPlugin(compilation);
      aotPlugin._program.getSourceFiles().forEach(sf => this.usePlatformUrl(sf));

      callback();
    });
  };

  public usePlatformUrl = (sourceFile: any) => {
    this.setCurrentDirectory(sourceFile);
    forEachChild(sourceFile, node => this.traverseDecorators(node));
  };

  public setCurrentDirectory = (sourceFile: any) => {
    this.currentDirectory = resolve(sourceFile.path, '..');
  };

  public traverseDecorators = (node: any) => {
    if (node.kind !== SyntaxKind.ClassDeclaration || !node.decorators) {
      return;
    }

    node.decorators.forEach(decorator => {
      this.traverseDecoratorArguments(decorator.expression.arguments);
    });
  };

  public traverseDecoratorArguments = (args: any) => {
    args.forEach(arg => arg.properties && this.traverseProperties(arg.properties));
  };

  public traverseProperties = (properties: any) => {
    properties.filter(prop => this.isRelevantNode(prop)).forEach(prop => this.traversePropertyElements(prop));
  };

  public isRelevantNode = (property: any) => {
    return (
      (this.resolveStylesUrls && property.name.text === 'styleUrls') ||
      (this.resolveTemplateUrl && property.name.text === 'templateUrl')
    );
  };

  public traversePropertyElements = (property: any) => {
    const elements =
      property.initializer.elements === undefined ? [property.initializer] : property.initializer.elements;

    elements
      .filter(el => !!el.text)
      .filter(el => this.notPlatformUrl(el.text))
      .filter(el => this.noMultiplatformFile(el.text))
      .forEach(el => this.replaceUrlsValue(el));
  };

  public notPlatformUrl = url => {
    const extensionStartIndex = url.lastIndexOf('.');
    const extension = url.slice(extensionStartIndex);

    return !url.endsWith(`.${this.platform}${extension}`);
  };

  public noMultiplatformFile = (url: any) => {
    const filePath = resolve(this.currentDirectory, url);

    return !existsSync(filePath);
  };

  public replaceUrlsValue = (element: any) => {
    const extensionStartIndex = element.text.lastIndexOf('.');
    const prefix = element.text.slice(0, extensionStartIndex);
    const currentExtension = element.text.slice(extensionStartIndex);

    element.text = `${prefix}.${this.platform}${currentExtension}`;
  };

  private getAotPlugin = compilation => {
    const maybeAotPlugin = compilation._ngToolsWebpackPluginInstance;
    if (!maybeAotPlugin) {
      throw new Error(`This plugin must be used with the AotPlugin!`);
    }

    return maybeAotPlugin;
  };
}
