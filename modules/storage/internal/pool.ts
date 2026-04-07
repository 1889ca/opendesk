/** Contract: contracts/storage/rules.md */
import pg from 'pg';
import { loadConfig } from '../../config/index.ts';

const pgConfig = loadConfig().postgres;

export const pool = new pg.Pool({
  host: pgConfig.host,
  port: pgConfig.port,
  database: pgConfig.database,
  user: pgConfig.user,
  password: pgConfig.password,
  max: pgConfig.maxConnections,
});
