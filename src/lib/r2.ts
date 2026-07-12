import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

/** Prefer dedicated clips worker (R2 binding) over S3 API tokens. */
export function clipsWorkerConfigured(): boolean {
  return Boolean(process.env.CLIPS_WORKER_URL && process.env.CLIPS_UPLOAD_SECRET);
}

export function r2Configured(): boolean {
  if (clipsWorkerConfigured()) return true;
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

export function getR2Client() {
  const accountId = required('R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  });
}

export function r2Bucket() {
  return required('R2_BUCKET');
}

/** Public base URL for objects (custom domain or r2.dev). */
export function r2PublicBase(): string {
  const custom = process.env.R2_PUBLIC_URL;
  if (custom) return custom.replace(/\/$/, '');
  const worker = process.env.CLIPS_WORKER_URL?.replace(/\/$/, '');
  if (worker) return `${worker}/object?key=`;
  return '';
}

export function publicUrlForKey(key: string): string {
  const worker = process.env.CLIPS_WORKER_URL?.replace(/\/$/, '');
  if (worker) {
    return `${worker}/object?key=${encodeURIComponent(key)}`;
  }
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (base) return `${base}/${key}`;
  // App-proxied playback
  return `/api/clips/media?key=${encodeURIComponent(key)}`;
}

/**
 * Get an upload target. Worker mode returns a direct PUT URL + secret header.
 * S3 mode returns a presigned PUT URL.
 */
export async function getUploadTarget(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<{
  mode: 'worker' | 's3';
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers?: Record<string, string>;
}> {
  if (clipsWorkerConfigured()) {
    const worker = process.env.CLIPS_WORKER_URL!.replace(/\/$/, '');
    return {
      mode: 'worker',
      uploadUrl: `${worker}/upload?key=${encodeURIComponent(opts.key)}`,
      key: opts.key,
      publicUrl: publicUrlForKey(opts.key),
      headers: {
        'Content-Type': opts.contentType,
        'x-clips-secret': process.env.CLIPS_UPLOAD_SECRET!,
      },
    };
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: opts.key,
    ContentType: opts.contentType,
  });
  const url = await getSignedUrl(client, command, { expiresIn: opts.expiresIn ?? 600 });
  return {
    mode: 's3',
    uploadUrl: url,
    key: opts.key,
    publicUrl: publicUrlForKey(opts.key),
  };
}

/** @deprecated use getUploadTarget */
export async function presignUpload(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const t = await getUploadTarget(opts);
  return { url: t.uploadUrl, key: t.key, publicUrl: t.publicUrl, headers: t.headers, mode: t.mode };
}

export async function presignDownload(key: string, expiresIn = 3600) {
  // Worker public GET is preferred
  const worker = process.env.CLIPS_WORKER_URL?.replace(/\/$/, '');
  if (worker) {
    return `${worker}/object?key=${encodeURIComponent(key)}`;
  }
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: r2Bucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/** Verify an object exists in R2 (worker HEAD or S3 HeadObject). */
export async function objectExists(key: string): Promise<boolean> {
  if (!key.startsWith('clips/') && !key.startsWith('prospects/')) return false;
  const worker = process.env.CLIPS_WORKER_URL?.replace(/\/$/, '');
  if (worker && process.env.CLIPS_UPLOAD_SECRET) {
    const res = await fetch(`${worker}/object?key=${encodeURIComponent(key)}`, {
      method: 'HEAD',
      headers: { 'x-clips-secret': process.env.CLIPS_UPLOAD_SECRET },
    });
    if (res.ok) return true;
    // Some workers may not support HEAD — try GET range
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(`${worker}/object?key=${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
          'x-clips-secret': process.env.CLIPS_UPLOAD_SECRET,
        },
      });
      return getRes.ok || getRes.status === 206;
    }
    return false;
  }
  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = getR2Client();
    await client.send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}
