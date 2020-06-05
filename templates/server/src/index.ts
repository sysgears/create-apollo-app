import { Server } from 'http';
//{^isWorkspace//}
import opn from 'opn';
//{/isWorkspace//}

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
      data.hotReloaded = true;
    });
    module.hot.addStatusHandler(status => {
      if (status === 'fail') {
        process.exit(250);
      }
    });
  }

  const firstStartInDevMode =
    module.hot && process.env.LAST_EXIT_CODE === '0' && (!module.hot.data || !module.hot.data.hotReloaded);

  startServer(PORT).then(serverInstance => {
    if (!module.hot || firstStartInDevMode) {
      console.log(`GraphQL Server is now running on http://localhost:${PORT}`);
      //{^isWorkspace//}
      if (firstStartInDevMode) {
        opn(`http://localhost:${PORT}/graphiql`);
      }
      //{/isWorkspace//}
    }

    server = serverInstance;
  });
} catch (e) {
  console.error(e);
  process.exit(1);
}
