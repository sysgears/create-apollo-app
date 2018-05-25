import { graphiqlExpress, graphqlExpress } from 'apollo-server-express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as express from 'express';

import schema from './schema';

import { execute, subscribe } from 'graphql';
import { createServer, Server } from 'http';
import { SubscriptionServer } from 'subscriptions-transport-ws';

export default async (port: number): Promise<Server> => {
  const app = express();

  const server: Server = createServer(app);

  app.use('*', cors({ origin: 'http://localhost:3000' }));

  app.use(
    '/graphql',
    bodyParser.json(),
    graphqlExpress({
      schema
    })
  );

  if (module.hot) {
    app.use(
      '/graphiql',
      graphiqlExpress({
        endpointURL: '/graphql',
        subscriptionsEndpoint: `ws://localhost:${port}/subscriptions`,
        query:
          '# Welcome to your own GraphQL server!\n#\n' +
          '# Press Play button above to execute GraphQL query\n#\n' +
          '# You can start editing source code and see results immediately\n\n' +
          'query salutation($subject:String) {\n  salutation(subject: $subject)\n}',
        variables: { subject: 'World' }
      })
    );
  }

  return new Promise<Server>(resolve => {
    server.listen(port, () => {
      // tslint:disable-next-line
      new SubscriptionServer(
        {
          execute,
          subscribe,
          schema
        },
        {
          server,
          path: '/subscriptions'
        }
      );
      resolve(server);
    });
  });
};
