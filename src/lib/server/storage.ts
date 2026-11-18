import { AwsClient } from "aws4fetch";
import { getAdminClient } from "./store";

export interface StoredObject {
  url: string;
  /** true when the URL points at our own /api/output route (no external storage) */
  local: boolean;
}

function r2Config() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE_URL,
  } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBase: R2_PUBLIC_BASE_URL ?? "",
  };
}

export function storageDriver(): "r2" | "supabase" | "local" {
  if (r2Config()) return "r2";
  if (getAdminClient()) return "supabase";
  return "local";
}

export async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<string | null> {
  const config = r2Config();
  if (!config) return null;
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;
  const response = await client.fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body as unknown as BodyInit,
  });
  if (!response.ok) return null;
  // Lifecycle rule on the bucket removes objects after 24h.
  return config.publicBase ? `${config.publicBase.replace(/\/$/, "")}/${key}` : endpoint;
}

export async function uploadToSupabase(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "photobooth-outputs";
  const { error } = await admin.storage.from(bucket).upload(key, body, {
    contentType,
    upsert: true,
  });
  if (error) return null;
  const { data } = await admin.storage.from(bucket).createSignedUrl(key, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export async function storeObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<StoredObject | null> {
  const driver = storageDriver();
  if (driver === "r2") {
    const url = await uploadToR2(key, body, contentType);
    if (url) return { url, local: false };
  }
  if (driver === "supabase") {
    const url = await uploadToSupabase(key, body, contentType);
    if (url) return { url, local: false };
  }
  return null;
}
