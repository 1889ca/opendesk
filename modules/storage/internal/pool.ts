/** Contract: contracts/storage/rules.md */
import pg from 'pg';

if (process.env.NODE_ENV === 'production' && !process.env.PG_PASSWORD) {
  throw new Error('PG_PASSWORD must be set in production');
}

export const pool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5433', 10),
  database: process.env.PG_DATABASE || 'opendesk',
  user: process.env.PG_USER || 'opendesk',
  password: process.env.PG_PASSWORD || 'opendesk_dev',
  max: 10,
});
