/** Contract: contracts/api/rules.md */
import { S3Client } from '@aws-sdk/client-s3';
import { loadConfig } from '../../config/index.ts';

const s3Config = loadConfig().s3;

export const s3Bucket = s3Config.bucket;

export const s3 = new S3Client({
  endpoint: s3Config.endpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
  forcePathStyle: true,
});
