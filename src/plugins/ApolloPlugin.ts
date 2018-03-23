import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

let persistPlugins;

export default class ApolloPlugin implements ConfigPlugin {
  public configure(builder: Builder, spin: Spin) {
    if (!builder.stack.hasAny('dll') && builder.stack.hasAll(['apollo', 'webpack'])) {
      const persistGraphQL = builder.persistGraphQL && !spin.test;
      if (builder.stack.hasAny(['server', 'web'])) {
        if (!persistPlugins) {
          const PersistGraphQLPlugin = builder.require('persistgraphql-webpack-plugin');
          // Tricky - this way it works for now both for single-package and monorepo projects
          const moduleName = path.resolve('node_modules/persisted_queries.json');
          if (persistGraphQL) {
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
            const clientPersistPlugin = new PersistGraphQLPlugin({ moduleName });
            const serverPersistPlugin = new PersistGraphQLPlugin({ moduleName });
            persistPlugins = { client: clientPersistPlugin, server: serverPersistPlugin };
          }
        }
      }

      builder.config = spin.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.graphqls/,
              use: 'raw-loader'
            },
            {
              test: /\.(graphql|gql)$/,
              exclude: /node_modules/,
              use: ['graphql-tag/loader'].concat(persistGraphQL ? ['persistgraphql-webpack-plugin/graphql-loader'] : [])
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
