import { Server } from 'http';
{;^isWorkspace;}
import * as opn from 'opn';
{;/isWorkspace;}

import startServer from './server';

try {
  const PORT = 8080;

  let server: Server;

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(data => {
      if (server) {
        server.close();
      }
      data.reloaded = true;
    });
  }

  startServer(PORT).then(serverInstance => {
    if (!module.hot || !module.hot.data) {
      console.log(`GraphQL Server is now running on http://localhost:${PORT}`);
      {;^isWorkspace;}

      if (module.hot) {
        opn(`http://localhost:${PORT}/graphiql`);
      }
      {;/isWorkspace;}
    }
    server = serverInstance;
  });
} catch (e) {
  console.error(e);
}
