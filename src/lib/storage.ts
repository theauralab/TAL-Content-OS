import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 speaks the S3 API. Files go browser -> R2 directly (presigned PUT) so large videos
// never pass through the serverless function, and are only read back through short-lived signed URLs.

export function storageConfigured() {
  const e = process.env;
  return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET_NAME);
}

let s3: S3Client | null = null;
function client() {
  if (!storageConfigured()) throw new Error("File storage isn't configured (R2_* environment variables)");
  s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    // Newer SDKs add CRC32 checksum params to presigned URLs, which browsers can't satisfy against R2.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3;
}
const Bucket = () => process.env.R2_BUCKET_NAME!;

export function presignUpload(key: string, contentType: string, expiresIn = 15 * 60) {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: Bucket(), Key: key, ContentType: contentType }), { expiresIn });
}

export function presignDownload(key: string, opts: { fileName: string; download: boolean; contentType?: string | null }, expiresIn = 60 * 60) {
  const safe = opts.fileName.replace(/["\\\r\n]/g, "_");
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: Bucket(),
      Key: key,
      ResponseContentDisposition: `${opts.download ? "attachment" : "inline"}; filename="${safe}"`,
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
    }),
    { expiresIn },
  );
}

/** Confirms the browser really uploaded the object, and reads its true size. */
export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const r = await client().send(new HeadObjectCommand({ Bucket: Bucket(), Key: key }));
    return { size: r.ContentLength ?? 0, contentType: r.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
  } catch {
    /* best effort */
  }
}
