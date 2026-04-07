/** Contract: contracts/api/rules.md */

import { S3Client } from '@aws-sdk/client-s3';

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY)
) {
  throw new Error(
    'S3_ACCESS_KEY and S3_SECRET_KEY must be set in production',
  );
}

const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
const accessKeyId = process.env.S3_ACCESS_KEY || 'opendesk';
const secretAccessKey = process.env.S3_SECRET_KEY || 'opendesk_dev';

export const s3Bucket = process.env.S3_BUCKET || 'opendesk';

export const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});
