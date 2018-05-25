import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

let persistPlugins;

export default class ApolloPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    if (!builder.stack.hasAny('dll') && builder.stack.hasAll(['apollo', 'webpack'])) {
      const persistGraphQL =
        builder.persistGraphQL && !spin.test && !!builder.require.probe('persistgraphql-webpack-plugin');
      if (builder.stack.hasAny(['server', 'web'])) {
        if (!persistPlugins) {
          // Tricky - this way it works for now both for single-package and monorepo projects
          const moduleName = path.resolve('node_modules/persisted_queries.json');
          if (persistGraphQL) {
            const PersistGraphQLPlugin = builder.require('persistgraphql-webpack-plugin');
            const clientPersistPlugin = new PersistGraphQLPlugin({
              moduleName,
              filename: 'extracted_queries.json',
              addTypename: true
            });
            const serverPersistPlugin = new PersistGraphQLPlugin({
              moduleName,
              provider: clientPersistPlugin
            });
            persistPlugins = { client: clientPersistPlugin, server: serverPersistPlugin };
          } else {
            // Dummy plugin instances just to create persisted_queries.json virtual module
            const VirtualModules = builder.require('webpack-virtual-modules');
            const clientPersistPlugin = new VirtualModules({ [moduleName]: '{}' });
            const serverPersistPlugin = new VirtualModules({ [moduleName]: '{}' });
            persistPlugins = { client: clientPersistPlugin, server: serverPersistPlugin };
          }
        }
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.graphqls/,
              use: { loader: 'raw-loader', options: spin.createConfig(builder, 'raw', {}) }
            },
            {
              test: /\.(graphql|gql)$/,
              exclude: /node_modules/,
              use: [{ loader: 'graphql-tag/loader', options: spin.createConfig(builder, 'graphqlTag', {}) }].concat(
                persistGraphQL ? ['persistgraphql-webpack-plugin/graphql-loader'] : ([] as any[])
              )
            }
          ]
        }
      });

      if (builder.stack.hasAny(['server', 'web'])) {
        const webpack = builder.require('webpack');

        if (persistGraphQL) {
          const jsRuleFinder = new JSRuleFinder(builder);
          const jsRule = jsRuleFinder.findAndCreateJSRule();
          jsRule.use = spin.merge(jsRule.use, ['persistgraphql-webpack-plugin/js-loader']);
        }

        builder.config = spin.merge(builder.config, {
          plugins: [
            new webpack.DefinePlugin({ __PERSIST_GQL__: persistGraphQL }),
            builder.stack.hasAny('server') ? persistPlugins.server : persistPlugins.client
          ]
        });
      }
    }
  }
}
