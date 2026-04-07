/** OpenDesk entry point */
import { loadConfig } from './modules/config/index.ts';
import { startServer } from './modules/api/index.ts';

const config = loadConfig();
await startServer(config.server.port);
