/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * RFC 3161 Timestamping Service – Shared Module
 *
 * Provides RFC 3161 qualified timestamping via any TSA endpoint.
 * Used by both IP Proof snapshots and compliance vault archives.
 *
 * RFC 3161 timestamps prove that a document existed in a specific form
 * at a specific point in time. When issued by an eIDAS-qualified TSA,
 * they carry legal presumption of accuracy across all EU member states.
 */

const DEFAULT_TSA_URL = process.env.RFC3161_TSA_URL || 'https://freetsa.org/tsr';

/**
 * Build an RFC 3161 TimeStampReq in DER format using raw ASN.1 encoding.
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
export function buildTimestampRequest(hash: Buffer): Buffer {
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
 * Wrap data in a DER TLV (Tag-Length-Value) structure.
 */
export function wrapDer(tag: number, content: Buffer): Buffer {
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
 * Submit a SHA-256 hash to an RFC 3161 TSA and get a signed timestamp token.
 *
 * @param contentHash - Hex-encoded SHA-256 hash of the content to timestamp
 * @param tsaUrl - URL of the Time Stamping Authority (defaults to RFC3161_TSA_URL env var or FreeTSA)
 * @returns DER-encoded TimeStampResp as Buffer
 */
export async function requestTimestamp(contentHash: string, tsaUrl?: string): Promise<Buffer> {
  const url = tsaUrl || DEFAULT_TSA_URL;
  const hashBuffer = Buffer.from(contentHash, 'hex');
  const tsReq = buildTimestampRequest(hashBuffer);

  const response = await fetch(url, {
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
    console.warn(`[RFC3161] TSA returned unexpected content-type: ${contentType}`);
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

  console.log(`[RFC3161] Timestamp received: ${tsResp.length} bytes from ${url}`);
  return tsResp;
}

/**
 * Validate that an RFC 3161 timestamp token is structurally valid DER
 * and contains the expected content hash.
 */
export function validateTimestampToken(token: Buffer, contentHash: string): boolean {
  if (!token || token.length < 10) return false;
  if (token[0] !== 0x30) return false;

  // Check that the hash appears in the token (basic validation)
  const tokenHex = token.toString('hex');
  return tokenHex.includes(contentHash.toLowerCase());
}

/**
 * Get the configured TSA URL.
 */
export function getTsaUrl(): string {
  return DEFAULT_TSA_URL;
}
