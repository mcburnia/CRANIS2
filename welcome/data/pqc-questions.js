/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const SECTIONS = [
  {
    id: 'asymmetric_crypto',
    title: 'Asymmetric Cryptography',
    description: 'Asymmetric (public-key) cryptography underpins TLS, code signing, authentication, and key exchange. Algorithms based on integer factorisation (RSA) and elliptic curves (ECDSA, ECDH, Ed25519) are vulnerable to Shor\'s algorithm on a cryptographically relevant quantum computer. NIST has published post-quantum replacements: ML-KEM (FIPS 203), ML-DSA (FIPS 204), and SLH-DSA (FIPS 205).',
  },
  {
    id: 'symmetric_and_hashing',
    title: 'Symmetric Encryption & Hashing',
    description: 'Symmetric algorithms (AES, ChaCha20) and hash functions (SHA-2, SHA-3) are less affected by quantum computing. Grover\'s algorithm halves the effective key length, so AES-128 drops to 64-bit equivalent security. AES-256 and SHA-256+ remain quantum-safe. Broken algorithms like MD5, SHA-1, DES, and RC4 are vulnerable today, regardless of quantum threats.',
  },
  {
    id: 'key_management',
    title: 'Key Management & Rotation',
    description: 'Key rotation frequency directly affects your quantum exposure window. Long-lived keys give attackers more time to collect encrypted traffic for future decryption (harvest-now, decrypt-later). Short rotation cycles reduce this window. Automated key management is essential for a smooth PQC migration, as algorithm changes will require re-keying across all systems.',
  },
  {
    id: 'crypto_agility',
    title: 'Cryptographic Agility',
    description: 'Crypto agility is the ability to swap cryptographic algorithms without major application changes. Organisations with hardcoded algorithms face costly migrations. Those using abstraction layers, configuration-driven crypto, or standards like TLS 1.3 (which negotiates algorithms dynamically) are better positioned for the PQC transition. The CRA\'s Annex I Part I §3 requires state-of-the-art cryptography.',
  },
  {
    id: 'data_sensitivity',
    title: 'Data Sensitivity & Exposure',
    description: 'The harvest-now, decrypt-later (HNDL) threat means that data encrypted today with quantum-vulnerable algorithms could be decrypted in the future. Organisations handling data with long confidentiality requirements (healthcare records, financial data, state secrets, intellectual property) face the greatest urgency. The NSA\'s CNSA 2.0 timeline requires PQC adoption by 2030 for national security systems.',
  },
  {
    id: 'migration_readiness',
    title: 'Migration Planning & Compliance',
    description: 'Successful PQC migration requires an inventory of all cryptographic usage, a prioritised migration plan, testing of PQC algorithms, and alignment with regulatory timelines. The CRA requires state-of-the-art cryptography (Annex I Part I §3). NIST\'s PQC standards (FIPS 203/204/205) are finalised. The CNSA 2.0 timeline mandates PQC for US national security systems by 2030, with hybrid solutions encouraged from 2025.',
  },
];

const QUESTIONS = [
  // ── Section 0: Asymmetric Cryptography ──
  {
    id: 'tls_key_type',
    section: 0,
    question: 'What key types do you use for TLS and digital signatures?',
    explanation: 'RSA and elliptic curve algorithms (ECDSA, ECDH, Ed25519) are mathematically vulnerable to Shor\'s algorithm. A sufficiently powerful quantum computer could break RSA-2048 in hours rather than the billions of years it would take a classical computer. NIST\'s post-quantum standards (ML-KEM for key exchange, ML-DSA for signatures) are designed to resist both classical and quantum attacks.',
    pqc_reference: 'NIST FIPS 203/204; CNSA 2.0',
    options: [
      { label: 'Don\'t know — we haven\'t audited our key types', score: 0 },
      { label: 'RSA only (RSA-2048 or RSA-4096)', score: 1 },
      { label: 'Elliptic curve (ECDSA, ECDH, Ed25519) and/or RSA', score: 1 },
      { label: 'Already using or testing PQC algorithms (ML-KEM, ML-DSA) alongside classical', score: 3 },
    ],
  },
  {
    id: 'rsa_key_size',
    section: 0,
    question: 'What RSA key sizes are in use across your systems?',
    explanation: 'Larger RSA keys take longer for a quantum computer to break, but all RSA key sizes are ultimately vulnerable to Shor\'s algorithm. RSA-1024 is already considered weak against classical attacks. RSA-2048 provides adequate classical security until ~2030. RSA-4096 buys marginally more time but does not solve the quantum problem. Only post-quantum algorithms provide long-term protection.',
    pqc_reference: 'NIST SP 800-57; CNSA 2.0',
    options: [
      { label: 'Don\'t know or N/A — we don\'t use RSA', score: 1 },
      { label: 'RSA-1024 or smaller still in use', score: 0 },
      { label: 'RSA-2048 standard, no RSA-1024 remaining', score: 1 },
      { label: 'RSA-4096 or larger, with a plan to migrate to PQC', score: 2 },
    ],
  },
  {
    id: 'key_exchange',
    section: 0,
    question: 'How do your systems perform key exchange?',
    explanation: 'Key exchange is the process by which two parties establish a shared secret over an insecure channel. Classic Diffie-Hellman and ECDH are quantum-vulnerable. TLS 1.3 already supports negotiation of new key exchange mechanisms, making it the easiest path to PQC key exchange via ML-KEM (Kyber). Chrome and other browsers have begun shipping hybrid ML-KEM + X25519 key exchange.',
    pqc_reference: 'NIST FIPS 203 (ML-KEM)',
    options: [
      { label: 'Don\'t know — we haven\'t reviewed our key exchange mechanisms', score: 0 },
      { label: 'Classic Diffie-Hellman or static RSA key exchange', score: 0 },
      { label: 'ECDH (e.g. X25519) via TLS 1.3', score: 1 },
      { label: 'Hybrid PQC key exchange (ML-KEM + classical) deployed or in testing', score: 3 },
    ],
  },

  // ── Section 1: Symmetric Encryption & Hashing ──
  {
    id: 'symmetric_algorithms',
    section: 1,
    question: 'What symmetric encryption algorithms do you use?',
    explanation: 'Grover\'s algorithm halves the effective security of symmetric ciphers: AES-128 drops to 64-bit equivalent, which is insecure. AES-256 drops to 128-bit, which remains safe. DES, 3DES, and RC4 are already broken by classical attacks. If you\'re using AES-256 or ChaCha20-Poly1305, your symmetric encryption is already quantum-safe.',
    pqc_reference: 'NIST SP 800-131A; CNSA 2.0',
    options: [
      { label: 'Don\'t know — we haven\'t inventoried our symmetric algorithms', score: 0 },
      { label: 'Still using DES, 3DES, RC4, or Blowfish in some systems', score: 0 },
      { label: 'AES-128 is our primary symmetric cipher', score: 1 },
      { label: 'AES-256 or ChaCha20-Poly1305 throughout', score: 3 },
    ],
  },
  {
    id: 'hash_functions',
    section: 1,
    question: 'What hash functions are in use across your systems?',
    explanation: 'MD5 and SHA-1 are broken by classical collision attacks and must not be used for any security purpose. SHA-256 and SHA-3 are quantum-safe — Grover\'s algorithm only provides a square-root speedup against hash functions, leaving SHA-256 with 128-bit equivalent quantum security, which is more than adequate.',
    pqc_reference: 'NIST SP 800-131A',
    options: [
      { label: 'Don\'t know — we haven\'t audited our hash usage', score: 0 },
      { label: 'MD5 or SHA-1 still used in some security contexts (signing, integrity checks)', score: 0 },
      { label: 'SHA-256 primarily, but some legacy SHA-1 or MD5 may remain', score: 1 },
      { label: 'SHA-256, SHA-384, SHA-512, or SHA-3 exclusively — no MD5 or SHA-1', score: 3 },
    ],
  },
  {
    id: 'password_hashing',
    section: 1,
    question: 'How do you hash and store passwords?',
    explanation: 'Modern password hashing functions like Argon2, bcrypt, and scrypt are designed to be computationally expensive, making brute-force attacks impractical even with quantum computers. MD5 or SHA-1 for password storage is critically insecure today. PBKDF2 with SHA-256 is acceptable but not optimal. Argon2id is the current best practice per OWASP.',
    pqc_reference: 'OWASP Password Storage Cheat Sheet',
    options: [
      { label: 'Don\'t know or N/A — we don\'t store passwords', score: 1 },
      { label: 'MD5, SHA-1, or unsalted hashes', score: 0 },
      { label: 'bcrypt or PBKDF2', score: 2 },
      { label: 'Argon2id with appropriate memory/time parameters', score: 3 },
    ],
  },

  // ── Section 2: Key Management & Rotation ──
  {
    id: 'rotation_frequency',
    section: 2,
    question: 'How often do you rotate your cryptographic keys?',
    explanation: 'Key rotation limits the window of exposure for any single key. In a harvest-now, decrypt-later scenario, shorter-lived keys mean less data is compromised if a future quantum computer can break the key. NIST SP 800-57 recommends rotation periods based on algorithm and use case. TLS session keys (ephemeral) are rotated per connection, which is ideal. Long-lived signing keys need explicit rotation policies.',
    pqc_reference: 'NIST SP 800-57 Part 1',
    options: [
      { label: 'Don\'t know — we have no key rotation policy', score: 0 },
      { label: 'Rarely or never — keys are rotated only when compromised', score: 0 },
      { label: 'Annually or on a fixed schedule', score: 1 },
      { label: 'Every 90 days or less, with automated rotation', score: 3 },
    ],
  },
  {
    id: 'key_management_system',
    section: 2,
    question: 'Do you use a centralised key management system (KMS)?',
    explanation: 'A KMS provides centralised control over key generation, storage, rotation, and revocation. During a PQC migration, a KMS makes it possible to re-key systems systematically rather than hunting for hardcoded keys across the codebase. Cloud KMS services (AWS KMS, Azure Key Vault, GCP Cloud KMS) are already adding PQC support.',
    pqc_reference: 'NIST SP 800-57; CISA PQC Migration Guidance',
    options: [
      { label: 'No — keys are managed manually or embedded in code/config', score: 0 },
      { label: 'Partial — some keys in a KMS, others in config files or environment variables', score: 1 },
      { label: 'Yes — centralised KMS for most systems (e.g. HashiCorp Vault, AWS KMS)', score: 2 },
      { label: 'Yes — KMS with automated rotation, audit logging, and PQC readiness', score: 3 },
    ],
  },
  {
    id: 'certificate_management',
    section: 2,
    question: 'How do you manage TLS certificates?',
    explanation: 'Certificate management is a leading indicator of PQC readiness. Organisations using automated certificate management (ACME/Let\'s Encrypt with 90-day certificates) can transition to PQC certificates more easily when CAs begin issuing them. Manual certificate management with long-lived certificates creates migration bottlenecks.',
    pqc_reference: 'NIST SP 1800-38 (draft)',
    options: [
      { label: 'Don\'t know — certificate management is ad hoc', score: 0 },
      { label: 'Manual — long-lived certificates (1+ year) renewed manually', score: 0 },
      { label: 'Semi-automated — ACME or managed service for public certs, manual for internal', score: 1 },
      { label: 'Fully automated — short-lived certificates (≤90 days) with automated renewal everywhere', score: 3 },
    ],
  },

  // ── Section 3: Cryptographic Agility ──
  {
    id: 'algorithm_abstraction',
    section: 3,
    question: 'Can you change cryptographic algorithms without modifying application code?',
    explanation: 'Crypto agility is the most important architectural property for PQC migration. If your algorithms are hardcoded (e.g. directly calling OpenSSL functions with specific algorithm parameters), every change requires code modifications, testing, and redeployment. If you use abstraction layers or configuration-driven crypto, you can swap algorithms centrally. The CRA\'s requirement for state-of-the-art cryptography (Annex I Part I §3) implies ongoing algorithm currency.',
    pqc_reference: 'CRA Annex I Part I §3; CISA PQC Migration Guidance',
    options: [
      { label: 'Don\'t know — we haven\'t assessed our crypto architecture', score: 0 },
      { label: 'No — algorithms are hardcoded in application code', score: 0 },
      { label: 'Partially — some systems use configurable crypto, others are hardcoded', score: 1 },
      { label: 'Yes — crypto algorithms are configuration-driven or abstracted behind a crypto service layer', score: 3 },
    ],
  },
  {
    id: 'tls_version',
    section: 3,
    question: 'What TLS versions do your systems support?',
    explanation: 'TLS 1.3 is the most PQC-ready protocol because it was designed with algorithm negotiation in mind and already supports hybrid key exchange experiments. TLS 1.2 can work but has a more rigid cipher suite structure. TLS 1.0 and 1.1 are deprecated and should not be in use. Supporting only TLS 1.3 provides the cleanest path to PQC.',
    pqc_reference: 'RFC 8446 (TLS 1.3); IETF PQC TLS drafts',
    options: [
      { label: 'Don\'t know — we haven\'t audited our TLS configuration', score: 0 },
      { label: 'TLS 1.0 or 1.1 still enabled', score: 0 },
      { label: 'TLS 1.2 minimum, TLS 1.3 supported', score: 1 },
      { label: 'TLS 1.3 only, with forward secrecy enforced', score: 3 },
    ],
  },
  {
    id: 'protocol_flexibility',
    section: 3,
    question: 'How easily can your infrastructure adopt new cryptographic protocols?',
    explanation: 'PQC migration will touch every layer: TLS termination, VPNs, SSH, code signing, API authentication, database encryption, and messaging. Organisations using modern infrastructure (managed load balancers, service meshes, infrastructure-as-code) can roll out changes centrally. Those with bespoke or legacy infrastructure face per-system migrations.',
    pqc_reference: 'CISA PQC Migration Guidance',
    options: [
      { label: 'Don\'t know — we haven\'t evaluated our infrastructure flexibility', score: 0 },
      { label: 'Difficult — many bespoke or legacy systems with fixed crypto configurations', score: 0 },
      { label: 'Moderate — most systems can be updated but some require significant effort', score: 1 },
      { label: 'Easy — infrastructure-as-code, managed services, and centralised crypto configuration', score: 3 },
    ],
  },

  // ── Section 4: Data Sensitivity & Exposure ──
  {
    id: 'data_confidentiality_period',
    section: 4,
    question: 'How long must your most sensitive data remain confidential?',
    explanation: 'This is the core harvest-now, decrypt-later question. If your data must remain confidential for 10+ years, and a cryptographically relevant quantum computer could arrive in 10–15 years, you need to act now. Data with short confidentiality requirements (e.g. session tokens, temporary credentials) faces less urgency but still needs eventual migration.',
    pqc_reference: 'NSA CNSA 2.0; NIST PQC FAQ',
    options: [
      { label: 'Less than 1 year — mostly transient or public data', score: 3 },
      { label: '1–5 years — business data with medium-term sensitivity', score: 2 },
      { label: '5–15 years — regulated data (financial, health, legal)', score: 1 },
      { label: '15+ years — national security, trade secrets, long-term IP, medical records', score: 0 },
    ],
  },
  {
    id: 'data_in_transit',
    section: 4,
    question: 'Is your network traffic at risk of being intercepted and stored?',
    explanation: 'Nation-state actors and sophisticated adversaries are known to intercept and store encrypted network traffic for future decryption. If your traffic crosses the public internet, uses shared infrastructure, or carries high-value data, the HNDL threat is real. VPN tunnels, private networks, and end-to-end encryption reduce but don\'t eliminate the risk.',
    pqc_reference: 'CISA HNDL Advisory; CNSA 2.0',
    options: [
      { label: 'Don\'t know — we haven\'t assessed our interception risk', score: 0 },
      { label: 'Low risk — internal systems only, no public internet exposure', score: 2 },
      { label: 'Moderate — some public internet traffic with standard TLS', score: 1 },
      { label: 'High — sensitive data regularly traverses the public internet or shared networks', score: 0 },
    ],
  },
  {
    id: 'stored_encrypted_data',
    section: 4,
    question: 'Do you have large volumes of data encrypted at rest with quantum-vulnerable algorithms?',
    explanation: 'Data encrypted at rest with AES-256 is quantum-safe. Data encrypted with AES-128 has reduced security under Grover\'s algorithm but is likely still adequate. Data encrypted with RSA or using RSA-wrapped keys is at risk. The volume of data matters because re-encryption of petabytes takes significant time and planning.',
    pqc_reference: 'NIST SP 800-131A; CISA PQC Guidance',
    options: [
      { label: 'Don\'t know — we haven\'t audited our encryption at rest', score: 0 },
      { label: 'Yes — significant data encrypted with RSA-wrapped keys or AES-128', score: 0 },
      { label: 'Some — mostly AES-256 but some legacy AES-128 or RSA key wrapping', score: 1 },
      { label: 'Minimal risk — AES-256 throughout, no RSA key wrapping for stored data', score: 3 },
    ],
  },

  // ── Section 5: Migration Planning & Compliance ──
  {
    id: 'crypto_inventory',
    section: 5,
    question: 'Do you maintain an inventory of all cryptographic algorithms, keys, and certificates in use?',
    explanation: 'You cannot migrate what you cannot see. A cryptographic inventory is the essential first step in any PQC migration. CISA\'s PQC migration guidance explicitly calls for organisations to inventory their cryptographic assets as step one. The CRA\'s Annex VII technical documentation requirements implicitly require this for products with digital elements.',
    pqc_reference: 'CISA PQC Migration Step 1; CRA Annex VII',
    options: [
      { label: 'No — we have no systematic crypto inventory', score: 0 },
      { label: 'Partial — we know about some systems but don\'t have a complete inventory', score: 1 },
      { label: 'Yes — we have a documented inventory but it\'s not regularly updated', score: 2 },
      { label: 'Yes — comprehensive, regularly updated inventory covering all systems, protocols, and third-party dependencies', score: 3 },
    ],
  },
  {
    id: 'migration_plan',
    section: 5,
    question: 'Do you have a plan for migrating to post-quantum cryptography?',
    explanation: 'A PQC migration plan should cover: prioritisation (which systems first, based on data sensitivity and HNDL risk), timeline (aligned with CNSA 2.0 or regulatory deadlines), testing strategy (interoperability, performance impact of larger PQC key sizes), and fallback procedures. NIST recommends beginning migration planning now, even if full deployment is years away.',
    pqc_reference: 'NIST PQC Migration Guidance; CNSA 2.0 Timeline',
    options: [
      { label: 'Not aware — we haven\'t considered PQC migration', score: 0 },
      { label: 'Aware — we know about PQC but haven\'t started planning', score: 1 },
      { label: 'Planning — we have a migration roadmap but haven\'t started implementation', score: 2 },
      { label: 'Active — migration plan in place, hybrid PQC deployed or in testing, timeline aligned with standards', score: 3 },
    ],
  },
  {
    id: 'regulatory_tracking',
    section: 5,
    question: 'Are you tracking PQC-relevant standards and regulatory requirements?',
    explanation: 'The PQC landscape is evolving rapidly. NIST finalised FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205 (SLH-DSA) in 2024. The EU CRA requires state-of-the-art cryptography. CNSA 2.0 sets deadlines for US national security systems. ETSI and ISO are developing PQC-related standards. Organisations that track these developments can align their migration with regulatory expectations.',
    pqc_reference: 'NIST FIPS 203/204/205; CRA Annex I §3; CNSA 2.0',
    options: [
      { label: 'No — we don\'t track cryptographic standards or regulations', score: 0 },
      { label: 'Aware — we know about NIST PQC but don\'t actively track developments', score: 1 },
      { label: 'Monitoring — we follow NIST, CNSA 2.0, and CRA developments', score: 2 },
      { label: 'Active — tracking standards, participating in industry groups, and aligning our roadmap with regulatory timelines', score: 3 },
    ],
  },
];

const READINESS_LABELS = {
  critical: 'Critical — Immediate Action Required',
  at_risk: 'At Risk — Significant Gaps',
  partially_ready: 'Partially Ready — Good Progress',
  quantum_ready: 'Quantum Ready — Well Prepared',
};

module.exports = { SECTIONS, QUESTIONS, READINESS_LABELS };
