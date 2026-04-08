/** Contract: contracts/api/rules.md */
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { loadConfig } from '../../config/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('s3');

let _s3: S3Client | null = null;
let _bucket: string | null = null;

function initS3() {
  const cfg = loadConfig().s3;
  _bucket = cfg.bucket;
  _s3 = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
    forcePathStyle: true,
  });
}

/** Lazy S3 client — created on first access so imports don't trigger config loading. */
export const s3: S3Client = new Proxy({} as S3Client, {
  get(_target, prop, receiver) {
    if (!_s3) initS3();
    const value = Reflect.get(_s3!, prop, receiver);
    return typeof value === 'function' ? value.bind(_s3!) : value;
  },
});

/** Lazy bucket name — resolved on first access. */
export function getS3Bucket(): string {
  if (!_bucket) initS3();
  return _bucket!;
}

/** Ensure the configured S3 bucket exists, creating it if needed. */
export async function ensureS3Bucket(): Promise<void> {
  const bucket = getS3Bucket();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    log.info('bucket not found, creating...', { bucket });
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    log.info('bucket created', { bucket });
  }
}
