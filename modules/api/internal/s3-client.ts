/** Contract: contracts/api/rules.md */
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import type { S3Config } from '../../config/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('s3');

let _s3: S3Client | null = null;
let _bucket: string | null = null;
let _s3Config: S3Config | null = null;

/** Inject S3Config from the composition root. Must be called before using s3/getS3Bucket. */
export function initS3(config: S3Config): void {
  _s3Config = config;
}

function ensureS3Client() {
  if (!_s3Config) {
    throw new Error('initS3() must be called before using the S3 client — pass S3Config from the composition root');
  }
  _bucket = _s3Config.bucket;
  _s3 = new S3Client({
    endpoint: _s3Config.endpoint,
    region: _s3Config.region,
    credentials: {
      accessKeyId: _s3Config.accessKey,
      secretAccessKey: _s3Config.secretKey,
    },
    forcePathStyle: true,
  });
}

/** Lazy S3 client — created on first access so imports don't trigger config loading. */
export const s3: S3Client = new Proxy({} as S3Client, {
  get(_target, prop, receiver) {
    if (!_s3) ensureS3Client();
    const value = Reflect.get(_s3!, prop, receiver);
    return typeof value === 'function' ? value.bind(_s3!) : value;
  },
});

/** Lazy bucket name — resolved on first access. */
export function getS3Bucket(): string {
  if (!_bucket) ensureS3Client();
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
