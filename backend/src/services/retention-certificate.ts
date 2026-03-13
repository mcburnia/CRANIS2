/**
 * Retention Funding Certificate Generator – P8 Phase D
 *
 * Generates a structured Markdown certificate proving that CRANIS2 has
 * allocated funds in a restricted retention reserve for the long-term
 * storage of a customer's compliance evidence archive.
 *
 * Each certificate is:
 *   - Signed with CRANIS2's Ed25519 key (Phase C)
 *   - RFC 3161 timestamped (Phase B)
 *   - Stored alongside the archive in Glacier
 *   - Hash-referenced in the retention reserve ledger
 */

import { createHash } from 'node:crypto';
import { signDocument } from './signing.js';
import { requestTimestamp, getTsaUrl } from './rfc3161.js';
import type { RetentionCostEstimate } from './retention-costing.js';

export interface CertificateInput {
  /** Ledger entry ID */
  ledgerId: string;
  /** Organisation details */
  orgName: string;
  orgId: string;
  /** Product details */
  productName: string;
  productId: string;
  /** Release version (if available) */
  releaseVersion: string | null;
  /** Archive details */
  archiveHash: string;
  archiveSizeBytes: number;
  coldStorageKey: string | null;
  /** Retention period */
  retentionStartDate: string | null;
  retentionEndDate: string | null;
  /** Cost estimate */
  costEstimate: RetentionCostEstimate;
  /** Snapshot ID */
  snapshotId: string;
}

export interface CertificateResult {
  /** The certificate content (Markdown) */
  content: string;
  /** SHA-256 hash of the certificate */
  contentHash: string;
  /** Ed25519 signature (or null if signing not configured) */
  signature: Buffer | null;
  /** RFC 3161 timestamp token (or null if timestamping failed) */
  rfc3161Token: Buffer | null;
}

function formatDate(d: string | Date | null): string {
  if (!d) return 'Not set';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/**
 * Generate a Retention Funding Certificate.
 *
 * The certificate is a structured Markdown document that proves CRANIS2
 * has allocated funds for the long-term retention of a compliance archive.
 */
export async function generateRetentionCertificate(
  input: CertificateInput,
): Promise<CertificateResult> {
  const now = new Date();
  const ce = input.costEstimate;

  const content = `# Retention Funding Certificate

**Certificate Reference:** RFC-${input.ledgerId.substring(0, 8).toUpperCase()}
**Issued:** ${formatDate(now)}
**Issued by:** CRANIS2 Managed CRA Evidence Retention

---

## 1. Beneficiary

| Field | Value |
|-------|-------|
| Organisation | ${input.orgName} |
| Organisation ID | ${input.orgId} |

## 2. Archived Evidence

| Field | Value |
|-------|-------|
| Product | ${input.productName} |
| Product ID | ${input.productId} |
| Release version | ${input.releaseVersion || 'N/A'} |
| Snapshot ID | ${input.snapshotId} |
| Archive hash (SHA-256) | \`${input.archiveHash}\` |
| Archive size | ${formatBytes(input.archiveSizeBytes)} |
| Cold storage path | ${input.coldStorageKey || 'Pending upload'} |

## 3. Retention Period

| Field | Value |
|-------|-------|
| Retention start | ${formatDate(input.retentionStartDate)} |
| Retention end | ${formatDate(input.retentionEndDate)} |
| Duration | ${ce.retentionMonths} months |
| Legal basis | CRA Art. 13(10) – minimum 10 years from market placement |

## 4. Financial Commitment

| Item | Amount |
|------|--------|
| Estimated storage cost | ${formatEur(ce.estimatedStorageCost)} |
| Estimated retrieval cost | ${formatEur(ce.estimatedRetrievalCost)} |
| Subtotal | ${formatEur(ce.estimatedCostBeforeBuffer)} |
| Buffer multiplier | ${ce.fundedAmount > 0 ? (ce.fundedAmount / ce.estimatedCostBeforeBuffer).toFixed(1) : '2.0'}x |
| **Funded amount** | **${formatEur(ce.fundedAmount)}** |

The funded amount of **${formatEur(ce.fundedAmount)}** has been allocated in a restricted
retention reserve for the exclusive benefit of **${input.orgName}** for the purpose of
maintaining the above compliance evidence archive for the full retention period.

## 5. Costing Model

| Field | Value |
|-------|-------|
| Model version | ${ce.costingModelVersion} |
| Calculation date | ${ce.calculationDate} |
| Storage rate | €${ce.estimatedStorageCost > 0 ? '0.00254' : '0.00'}/GB/month (Scaleway Glacier) |
| Currency | EUR |

## 6. Ledger Reference

| Field | Value |
|-------|-------|
| Ledger entry ID | ${input.ledgerId} |
| Status | Allocated |

---

## Declarations

1. **Restricted reserve:** The funded amount is held in a restricted retention reserve
   account, separate from CRANIS2's operating funds, and may only be used for the
   storage and retrieval of the identified compliance evidence archive.

2. **Survivability:** In the event that CRANIS2 ceases operations, the retention
   reserve and all archived evidence will be transferred to a designated custodian
   to ensure continuity of the retention obligation.

3. **Customer right of retrieval:** The beneficiary may request retrieval of the
   archived evidence at any time during the retention period at no additional cost.

4. **Audit access:** This certificate and the underlying ledger entry are available
   for inspection by the beneficiary, their auditors, and EU market surveillance
   authorities upon request.

---

*This certificate was generated by CRANIS2 and is digitally signed with CRANIS2's
Ed25519 key pair. The signature can be verified using the public key published at
\`/.well-known/cranis2-signing-key.pem\`.*

*Generated: ${now.toISOString()}*
`;

  // Hash the certificate
  const contentHash = createHash('sha256').update(content, 'utf-8').digest('hex');

  // Sign the certificate
  let signature: Buffer | null = null;
  try {
    const sigResult = signDocument(Buffer.from(content, 'utf-8'));
    if (sigResult) {
      signature = sigResult.signature;
    }
  } catch (err: any) {
    console.error('[RETENTION-CERT] Signing failed (non-blocking):', err.message);
  }

  // RFC 3161 timestamp
  let rfc3161Token: Buffer | null = null;
  try {
    rfc3161Token = await requestTimestamp(contentHash, getTsaUrl());
  } catch (err: any) {
    console.error('[RETENTION-CERT] RFC 3161 timestamp failed (non-blocking):', err.message);
  }

  return {
    content,
    contentHash,
    signature,
    rfc3161Token,
  };
}
