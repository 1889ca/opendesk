/** OpenDesk entry point */
import { startServer } from './modules/api/index.ts';

const port = parseInt(process.env.PORT || '3000', 10);
startServer(port);
