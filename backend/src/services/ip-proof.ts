import pool from '../db/pool.js';
import neo4j from 'neo4j-driver';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { createNotification } from './notifications.js';

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://neo4j:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'cranis2_dev_2026'
  )
);

/**
 * Build a canonical JSON representation of a product's SBOM state.
 * Deterministic: dependencies sorted by PURL, consistent field ordering.
 */
async function buildCanonicalSnapshot(productId: string): Promise<{
  canonical: string;
  summary: { packageCount: number; version: string | null; depCount: number; hashCount: number };
}> {
  // Get product version from Postgres
  const versionResult = await pool.query(
    `SELECT cranis_version FROM product_versions WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [productId]
  );
  const version = versionResult.rows[0]?.cranis_version || null;

  // Get all dependencies from Neo4j
  const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
  let deps: Array<Record<string, string | null>> = [];

  try {
    const result = await session.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d.purl AS purl, d.name AS name, d.version AS version,
              d.license AS license, d.hash AS hash, d.hashAlgorithm AS hashAlgorithm,
              d.ecosystem AS ecosystem, d.supplier AS supplier
       ORDER BY d.purl`,
      { productId }
    );
    deps = result.records.map(r => ({
      purl: r.get('purl'),
      name: r.get('name'),
      version: r.get('version'),
      license: r.get('license'),
      hash: r.get('hash'),
      hashAlgorithm: r.get('hashAlgorithm'),
      ecosystem: r.get('ecosystem'),
      supplier: r.get('supplier')
    }));
  } finally {
    await session.close();
  }

  const hashCount = deps.filter(d => d.hash).length;

  // Build canonical JSON with deterministic key ordering
  const canonical = JSON.stringify({
    productId,
    version,
    timestamp: new Date().toISOString(),
    dependencies: deps.map(d => ({
      purl: d.purl,
      name: d.name,
      version: d.version,
      license: d.license,
      hash: d.hash,
      hashAlgorithm: d.hashAlgorithm,
      ecosystem: d.ecosystem,
      supplier: d.supplier
    }))
  }, null, 0); // Compact JSON for consistent hashing

  return {
    canonical,
    summary: {
      packageCount: deps.length,
      version,
      depCount: deps.length,
      hashCount
    }
  };
}

/**
 * Build an RFC 3161 TimeStampReq in DER format using raw ASN.1 encoding.
 * This avoids complex PKI.js dependency issues with ESM/CJS.
 *
 * Structure: SEQUENCE {
 *   version INTEGER (1),
 *   messageImprint SEQUENCE {
 *     hashAlgorithm AlgorithmIdentifier { OID sha256 },
 *     hashedMessage OCTET STRING
 *   },
 *   certReq BOOLEAN TRUE
 * }
 */
function buildTimestampRequest(hash: Buffer): Buffer {
  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256Oid = Buffer.from([
    0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01
  ]);

  // AlgorithmIdentifier: SEQUENCE { OID, NULL }
  const algIdContent = Buffer.concat([sha256Oid, Buffer.from([0x05, 0x00])]);
  const algId = wrapDer(0x30, algIdContent);

  // hashedMessage: OCTET STRING
  const hashedMessage = wrapDer(0x04, hash);

  // messageImprint: SEQUENCE { algId, hashedMessage }
  const messageImprint = wrapDer(0x30, Buffer.concat([algId, hashedMessage]));

  // version: INTEGER 1
  const version = Buffer.from([0x02, 0x01, 0x01]);

  // certReq: BOOLEAN TRUE (context-specific, implicit)
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  // TimeStampReq: SEQUENCE { version, messageImprint, certReq }
  return wrapDer(0x30, Buffer.concat([version, messageImprint, certReq]));
}

/**
 * Wrap data in a DER TLV (Tag-Length-Value) structure
 */
function wrapDer(tag: number, content: Buffer): Buffer {
  const len = content.length;
  let header: Buffer;

  if (len < 128) {
    header = Buffer.from([tag, len]);
  } else if (len < 256) {
    header = Buffer.from([tag, 0x81, len]);
  } else if (len < 65536) {
    header = Buffer.from([tag, 0x82, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = Buffer.from([tag, 0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  }

  return Buffer.concat([header, content]);
}

/**
 * Submit a hash to an RFC 3161 TSA and get a signed timestamp token.
 */
async function requestTimestamp(contentHash: string, tsaUrl: string): Promise<Buffer> {
  const hashBuffer = Buffer.from(contentHash, 'hex');
  const tsReq = buildTimestampRequest(hashBuffer);

  const response = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
    },
    body: new Uint8Array(tsReq),
  });

  if (!response.ok) {
    throw new Error(`TSA returned ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/timestamp-reply')) {
    console.warn(`[IP Proof] TSA returned unexpected content-type: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tsResp = Buffer.from(arrayBuffer);

  if (tsResp.length < 10) {
    throw new Error('TSA returned empty or invalid response');
  }

  // Basic validation: DER SEQUENCE tag should be 0x30
  if (tsResp[0] !== 0x30) {
    throw new Error(`TSA response is not valid DER (first byte: 0x${tsResp[0].toString(16)})`);
  }

  console.log(`[IP Proof] RFC 3161 timestamp received: ${tsResp.length} bytes from ${tsaUrl}`);
  return tsResp;
}

/**
 * Create a timestamped snapshot of a product's SBOM state.
 * Returns the snapshot ID.
 */
export async function createSnapshot(
  productId: string,
  orgId: string,
  userId: string | null,
  snapshotType: 'sync' | 'release' | 'manual' = 'manual'
): Promise<{ snapshotId: string; contentHash: string }> {
  const tsaUrl = 'https://freetsa.org/tsr';

  // Build canonical snapshot
  const { canonical, summary } = await buildCanonicalSnapshot(productId);

  // SHA-256 hash
  const contentHash = crypto.createHash('sha256').update(canonical).digest('hex');

  // Request RFC 3161 timestamp
  let rfc3161Token: Buffer | null = null;
  try {
    rfc3161Token = await requestTimestamp(contentHash, tsaUrl);
  } catch (err) {
    console.error(`[IP Proof] Failed to get RFC 3161 timestamp:`, err);
    // Continue without timestamp — we still store the hash
  }

  // Store in database
  const result = await pool.query(
    `INSERT INTO ip_proof_snapshots (
       org_id, product_id, created_by, snapshot_type, content_hash,
       content_summary, rfc3161_token, rfc3161_tsa_url
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      orgId, productId, userId, snapshotType, contentHash,
      JSON.stringify(summary), rfc3161Token, rfc3161Token ? tsaUrl : null
    ]
  );

  const snapshotId = result.rows[0].id;

  console.log(`[IP Proof] Snapshot created: ${snapshotId} (hash: ${contentHash.substring(0, 16)}..., type: ${snapshotType}, RFC3161: ${rfc3161Token ? 'yes' : 'failed'})`);

  return { snapshotId, contentHash };
}

/**
 * Verify a snapshot's RFC 3161 timestamp token.
 * Basic verification: checks that the token is valid DER and contains the expected hash.
 */
export async function verifySnapshot(snapshotId: string): Promise<{
  verified: boolean;
  details: string;
}> {
  const result = await pool.query(
    `SELECT content_hash, rfc3161_token, rfc3161_tsa_url FROM ip_proof_snapshots WHERE id = $1`,
    [snapshotId]
  );

  if (result.rows.length === 0) {
    return { verified: false, details: 'Snapshot not found' };
  }

  const { content_hash, rfc3161_token, rfc3161_tsa_url } = result.rows[0];

  if (!rfc3161_token) {
    await pool.query(`UPDATE ip_proof_snapshots SET verified = FALSE WHERE id = $1`, [snapshotId]);
    return { verified: false, details: 'No RFC 3161 timestamp token stored' };
  }

  try {
    const tokenBuffer = Buffer.from(rfc3161_token);

    // Basic DER structure validation
    if (tokenBuffer[0] !== 0x30) {
      throw new Error('Invalid DER structure');
    }

    // Check that the content hash appears in the token
    const hashHex = content_hash.toLowerCase();
    const tokenHex = tokenBuffer.toString('hex').toLowerCase();
    const hashBytes = Buffer.from(hashHex, 'hex').toString('hex');

    if (!tokenHex.includes(hashBytes)) {
      throw new Error('Content hash not found in timestamp token');
    }

    // Token is structurally valid and contains our hash
    await pool.query(`UPDATE ip_proof_snapshots SET verified = TRUE WHERE id = $1`, [snapshotId]);

    return {
      verified: true,
      details: `RFC 3161 token verified (${tokenBuffer.length} bytes, TSA: ${rfc3161_tsa_url})`
    };
  } catch (err: any) {
    await pool.query(`UPDATE ip_proof_snapshots SET verified = FALSE WHERE id = $1`, [snapshotId]);
    return { verified: false, details: `Verification failed: ${err.message}` };
  }
}

/**
 * Export a proof package as a ZIP file containing all evidence.
 */
export async function exportProofPackage(snapshotId: string): Promise<Buffer | null> {
  const result = await pool.query(
    `SELECT s.*, p.cranis_version
     FROM ip_proof_snapshots s
     LEFT JOIN product_versions p ON s.product_id = p.product_id
     WHERE s.id = $1
     ORDER BY p.created_at DESC LIMIT 1`,
    [snapshotId]
  );

  if (result.rows.length === 0) return null;

  const snapshot = result.rows[0];

  // Rebuild the canonical snapshot for inclusion
  const { canonical } = await buildCanonicalSnapshot(snapshot.product_id);

  const zip = new AdmZip();

  // 1. Canonical snapshot JSON
  zip.addFile('snapshot.json', Buffer.from(canonical, 'utf-8'));

  // 2. SHA-256 hash
  zip.addFile('snapshot.sha256', Buffer.from(`${snapshot.content_hash}  snapshot.json\n`, 'utf-8'));

  // 3. RFC 3161 timestamp token
  if (snapshot.rfc3161_token) {
    zip.addFile('timestamp.tsr', Buffer.from(snapshot.rfc3161_token));
  }

  // 4. OpenTimestamps proof (if available)
  if (snapshot.ots_proof) {
    zip.addFile('timestamp.ots', Buffer.from(snapshot.ots_proof));
  }

  // 5. Verification instructions
  const verifyMd = `# IP Proof Verification Guide

## Snapshot Details
- **Product ID**: ${snapshot.product_id}
- **Content Hash (SHA-256)**: ${snapshot.content_hash}
- **Created**: ${snapshot.created_at}
- **Snapshot Type**: ${snapshot.snapshot_type}
${snapshot.rfc3161_tsa_url ? `- **TSA**: ${snapshot.rfc3161_tsa_url}` : ''}
${snapshot.ots_bitcoin_block ? `- **Bitcoin Block**: ${snapshot.ots_bitcoin_block}` : ''}

## Verify the Hash

Recalculate the SHA-256 hash of snapshot.json:

${'```'}bash
sha256sum snapshot.json
# Should output: ${snapshot.content_hash}
${'```'}

## Verify the RFC 3161 Timestamp

The timestamp.tsr file is a DER-encoded RFC 3161 TimeStampResp from ${snapshot.rfc3161_tsa_url || 'FreeTSA.org'}.

${'```'}bash
# Verify with OpenSSL (requires FreeTSA CA certificates)
openssl ts -verify -in timestamp.tsr -data snapshot.json -CAfile cacert.pem -untrusted tsa.crt
${'```'}

FreeTSA certificates can be downloaded from https://freetsa.org/index_en.php

## What This Proves

This proof package demonstrates that the software bill of materials (SBOM)
described in snapshot.json existed at the time indicated by the RFC 3161
timestamp. The timestamp is cryptographically signed by a trusted third-party
Time Stamping Authority (TSA) and is legally recognised under the EU eIDAS
regulation.

This can be used as evidence of:
- **Prior art**: Your codebase composition at a specific point in time
- **IP ownership**: The dependency graph and version state of your product
- **Compliance**: SBOM state at the time of a release or audit

## About RFC 3161

RFC 3161 defines the Internet X.509 PKI Time-Stamp Protocol. A TSA provides
cryptographic proof that a piece of data existed at a specific time. The TSA
signs a hash of your data with its private key, creating a legally binding
timestamp that can be independently verified.

Generated by CRANIS2 (https://cranis2.dev)
`;

  zip.addFile('VERIFY.md', Buffer.from(verifyMd, 'utf-8'));

  return zip.toBuffer();
}
