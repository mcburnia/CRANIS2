#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Signing Key Generator
#
# Generates Ed25519 and ML-DSA-65 key pairs for document signing.
# Outputs base64-encoded PEM values ready for .env configuration.
#
# Usage:
#   ./scripts/generate-signing-keys.sh              # generate both key pairs
#   ./scripts/generate-signing-keys.sh --ed25519    # Ed25519 only
#   ./scripts/generate-signing-keys.sh --mldsa      # ML-DSA-65 only
#
# Output:
#   Prints base64-encoded private keys for .env and PEM public keys
#   for the .well-known directory.
#
# Requirements:
#   Node.js 24+ (for ML-DSA-65 support)
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
GEN_ED25519=true
GEN_MLDSA=true
for arg in "$@"; do
  case "$arg" in
    --ed25519) GEN_MLDSA=false ;;
    --mldsa)   GEN_ED25519=false ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# Ensure Node.js is available
if ! bash -c 'source ~/.nvm/nvm.sh && node --version' > /dev/null 2>&1; then
  echo "ERROR: Node.js not available via nvm"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          CRANIS2 SIGNING KEY GENERATOR                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Generate keys using Node.js
bash -c "source ~/.nvm/nvm.sh && node -e \"
const crypto = require('crypto');

const genEd25519 = ${GEN_ED25519};
const genMldsa = ${GEN_MLDSA};

if (genEd25519) {
  console.log('── Ed25519 Key Pair ──────────────────────────────────────────');
  console.log('');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const b64Priv = Buffer.from(privPem).toString('base64');

  const keyId = crypto.createHash('sha256').update(pubPem).digest('hex').substring(0, 8);

  console.log('Key ID:     ' + keyId);
  console.log('Algorithm:  Ed25519');
  console.log('Sig size:   64 bytes');
  console.log('');
  console.log('Add to .env:');
  console.log('  CRANIS2_SIGNING_KEY=' + b64Priv);
  console.log('');
  console.log('Public key PEM (for .well-known/cranis2-signing-key.pem):');
  console.log(pubPem);
}

if (genMldsa) {
  console.log('── ML-DSA-65 Key Pair ───────────────────────────────────────');
  console.log('');

  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ml-dsa-65');

    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
    const b64Priv = Buffer.from(privPem).toString('base64');

    const keyId = crypto.createHash('sha256').update(pubPem).digest('hex').substring(0, 8);

    // Measure signature size
    const testSig = crypto.sign(null, Buffer.from('test'), privateKey);

    console.log('Key ID:     ' + keyId);
    console.log('Algorithm:  ML-DSA-65 (FIPS 204)');
    console.log('Sig size:   ' + testSig.length + ' bytes');
    console.log('');
    console.log('Add to .env:');
    console.log('  CRANIS2_SIGNING_KEY_MLDSA=' + b64Priv);
    console.log('');
    console.log('Public key PEM (for .well-known/cranis2-signing-key-mldsa.pem):');
    console.log(pubPem);
  } catch (e) {
    console.log('ERROR: ML-DSA-65 not available. Requires Node.js 24+ with OpenSSL 3.5+.');
    console.log('Current Node.js: ' + process.version);
    console.log('Error: ' + e.message);
  }
}
\""