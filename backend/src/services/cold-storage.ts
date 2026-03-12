/**
 * Cold Storage Service — P8 #42
 *
 * Uploads compliance snapshots to Scaleway Object Storage (Glacier class)
 * for long-term audit retention per CRA Art. 13(10).
 *
 * - Active customers: Glacier copies retained indefinitely
 * - Departed customers: 90-day grace period, then purged
 * - Local ZIP files: purged after 24 hours
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import pool from '../db/pool.js';

// ── S3-compatible client for Scaleway ──
const SCW_REGION = process.env.SCW_REGION || 'fr-par';
const SCW_BUCKET = process.env.SCW_BUCKET_NAME || 'cranis2-compliance-archive';
const SCW_ENDPOINT = `https://s3.${SCW_REGION}.scw.cloud`;

function createS3Client(): S3Client | null {
  const accessKey = process.env.SCW_ACCESS_KEY;
  const secretKey = process.env.SCW_SECRET_KEY;

  if (!accessKey || !secretKey || accessKey === 'scw-placeholder') {
    return null;
  }

  return new S3Client({
    region: SCW_REGION,
    endpoint: SCW_ENDPOINT,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });
}

let s3Client: S3Client | null = null;
let bucketVerified = false;

function getClient(): S3Client | null {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

/**
 * Ensure the bucket exists, create it if not.
 */
async function ensureBucket(): Promise<void> {
  if (bucketVerified) return;

  const client = getClient();
  if (!client) return;

  try {
    await client.send(new HeadBucketCommand({ Bucket: SCW_BUCKET }));
    bucketVerified = true;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`[COLD-STORAGE] Creating bucket: ${SCW_BUCKET}`);
      await client.send(new CreateBucketCommand({ Bucket: SCW_BUCKET }));
      bucketVerified = true;
    } else {
      throw err;
    }
  }
}

/**
 * Build the S3 object key for a snapshot.
 */
function buildObjectKey(orgId: string, productId: string, filename: string): string {
  return `${orgId}/${productId}/${filename}`;
}

/**
 * Upload a compliance snapshot ZIP to Scaleway Glacier.
 * Updates the compliance_snapshots record with cold storage metadata.
 */
export async function uploadToGlacier(
  orgId: string,
  productId: string,
  filename: string,
  filepath: string,
  snapshotId: string,
): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn('[COLD-STORAGE] Scaleway credentials not configured — skipping upload');
    return;
  }

  const objectKey = buildObjectKey(orgId, productId, filename);

  try {
    await ensureBucket();

    const fileBuffer = await readFile(filepath);

    await client.send(new PutObjectCommand({
      Bucket: SCW_BUCKET,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: 'application/zip',
      StorageClass: 'GLACIER',
    }));

    // Update DB record
    await pool.query(
      `UPDATE compliance_snapshots
       SET cold_storage_key = $1, cold_storage_status = 'archived', cold_storage_uploaded_at = NOW()
       WHERE id = $2`,
      [objectKey, snapshotId]
    );

    console.log(`[COLD-STORAGE] Uploaded ${objectKey} (${(fileBuffer.length / 1024).toFixed(0)} KB)`);
  } catch (err: any) {
    console.error(`[COLD-STORAGE] Upload failed for ${objectKey}:`, err.message);

    await pool.query(
      `UPDATE compliance_snapshots SET cold_storage_status = 'failed' WHERE id = $1`,
      [snapshotId]
    );
  }
}

/**
 * Delete a snapshot from Scaleway Object Storage.
 */
export async function deleteFromGlacier(
  orgId: string,
  productId: string,
  filename: string,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const objectKey = buildObjectKey(orgId, productId, filename);

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: SCW_BUCKET,
      Key: objectKey,
    }));
    console.log(`[COLD-STORAGE] Deleted ${objectKey}`);
  } catch (err: any) {
    // Log but don't throw — best-effort cleanup
    console.error(`[COLD-STORAGE] Delete failed for ${objectKey}:`, err.message);
  }
}

/**
 * Check if cold storage is configured and available.
 */
export function isColdStorageConfigured(): boolean {
  return getClient() !== null;
}
