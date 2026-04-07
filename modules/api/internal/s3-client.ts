/** Contract: contracts/api/rules.md */
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
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

/** Ensure the configured S3 bucket exists, creating it if needed. */
export async function ensureS3Bucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: s3Bucket }));
  } catch {
    console.log(`[s3] bucket "${s3Bucket}" not found, creating...`);
    await s3.send(new CreateBucketCommand({ Bucket: s3Bucket }));
    console.log(`[s3] bucket "${s3Bucket}" created`);
  }
}
