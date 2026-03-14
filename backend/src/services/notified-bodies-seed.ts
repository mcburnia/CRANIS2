/**
 * Notified Bodies — Seed Data
 *
 * Initial set of EU cybersecurity certification bodies likely to be designated
 * as CRA notified bodies. Based on existing eIDAS, Common Criteria, and
 * EUCC (EU Cybersecurity Certification) accreditations.
 *
 * Data source: NANDO database, ENISA EUCC scheme, national accreditation bodies.
 * Last reviewed: 2026-03-14
 *
 * Note: CRA notified body designations are still being finalised by member states.
 * This seed provides a starting point; admins can add/update entries as
 * official designations are published.
 */

import pool from '../db/pool.js';

export interface NotifiedBodySeed {
  name: string;
  country: string;
  nando_number: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  cra_modules: string[];
  sectors: string[];
  accreditation_status: 'active' | 'suspended' | 'withdrawn';
  accreditation_date: string | null;
  notes: string | null;
}

const SEED_BODIES: NotifiedBodySeed[] = [
  // ── Germany ─────────────────────────────────────────────────
  {
    name: 'Bundesamt fur Sicherheit in der Informationstechnik (BSI)',
    country: 'DE',
    nando_number: null,
    website: 'https://www.bsi.bund.de',
    email: null,
    phone: '+49 228 99 9582 0',
    address: 'Godesberger Allee 185-189, 53175 Bonn, Germany',
    cra_modules: ['B', 'C', 'H'],
    sectors: ['general', 'networking', 'industrial', 'iot'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'German Federal Office for Information Security. National cybersecurity authority with Common Criteria and EUCC certification capabilities. Expected to be among the first CRA notified bodies.',
  },
  {
    name: 'TUV Informationstechnik GmbH (TUViT)',
    country: 'DE',
    nando_number: null,
    website: 'https://www.tuvit.de',
    email: 'info@tuvit.de',
    phone: '+49 201 8999 699',
    address: 'Langemarckstrasse 20, 45141 Essen, Germany',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking', 'iot', 'industrial'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'IT security evaluation and certification body. Accredited Common Criteria ITSEF and EUCC evaluation facility.',
  },
  {
    name: 'atsec information security GmbH',
    country: 'DE',
    nando_number: null,
    website: 'https://www.atsec.com',
    email: 'info@atsec.com',
    phone: '+49 89 442 498 30',
    address: 'Steinstrasse 70, 81667 Munich, Germany',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Common Criteria evaluation facility accredited by BSI. Specialises in operating systems, network devices, and cryptographic modules.',
  },

  // ── France ──────────────────────────────────────────────────
  {
    name: 'Agence nationale de la securite des systemes d\'information (ANSSI)',
    country: 'FR',
    nando_number: null,
    website: 'https://www.ssi.gouv.fr',
    email: null,
    phone: '+33 1 71 75 82 82',
    address: '51 boulevard de La Tour-Maubourg, 75700 Paris, France',
    cra_modules: ['B', 'C', 'H'],
    sectors: ['general', 'networking', 'industrial', 'telecoms'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'French national cybersecurity agency. Operates the CSPN and Common Criteria certification schemes. Expected to be a key CRA notified body.',
  },
  {
    name: 'Laboratoire OPPIDA',
    country: 'FR',
    nando_number: null,
    website: 'https://www.oppida.fr',
    email: 'contact@oppida.fr',
    phone: '+33 1 30 14 19 00',
    address: '4 place Colonel Grubert, 78000 Versailles, France',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking', 'iot'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'ANSSI-accredited CESTI (IT security evaluation centre). Common Criteria and CSPN evaluations.',
  },

  // ── Netherlands ─────────────────────────────────────────────
  {
    name: 'Brightsight BV',
    country: 'NL',
    nando_number: null,
    website: 'https://www.brightsight.com',
    email: 'info@brightsight.com',
    phone: '+31 15 269 5400',
    address: 'Delftechpark 1, 2628 XJ Delft, Netherlands',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'iot', 'financial'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'NSCIB-accredited Common Criteria evaluation facility. Strong in smart card, IoT, and payment security.',
  },

  // ── Spain ───────────────────────────────────────────────────
  {
    name: 'Centro Criptologico Nacional (CCN)',
    country: 'ES',
    nando_number: null,
    website: 'https://www.ccn-cert.cni.es',
    email: null,
    phone: '+34 91 372 57 00',
    address: 'Calle Argentona 30, 28023 Madrid, Spain',
    cra_modules: ['B', 'C', 'H'],
    sectors: ['general', 'networking', 'industrial'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Spanish national cryptology centre. Operates the LINCE and Common Criteria certification schemes.',
  },
  {
    name: 'Epoche & Espri SL',
    country: 'ES',
    nando_number: null,
    website: 'https://www.epocheespri.com',
    email: 'info@epocheespri.com',
    phone: '+34 91 745 21 00',
    address: 'Madrid, Spain',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'iot'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'CCN-accredited IT security evaluation laboratory.',
  },

  // ── Italy ───────────────────────────────────────────────────
  {
    name: 'Organismo di Certificazione della Sicurezza Informatica (OCSI)',
    country: 'IT',
    nando_number: null,
    website: 'https://www.ocsi.gov.it',
    email: null,
    phone: '+39 06 8526 4822',
    address: 'Via Nazionale 248, 00184 Rome, Italy',
    cra_modules: ['B', 'C', 'H'],
    sectors: ['general', 'networking', 'industrial'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Italian national IT security certification body. Common Criteria scheme operator.',
  },

  // ── Sweden ──────────────────────────────────────────────────
  {
    name: 'Swedish Certification Body for IT Security (CSEC)',
    country: 'SE',
    nando_number: null,
    website: 'https://www.fmv.se/csec',
    email: null,
    phone: '+46 8 782 40 00',
    address: 'FMV, 115 88 Stockholm, Sweden',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Swedish Defence Materiel Administration (FMV) operates the CSEC Common Criteria scheme.',
  },

  // ── Finland ─────────────────────────────────────────────────
  {
    name: 'National Cyber Security Centre Finland (NCSC-FI)',
    country: 'FI',
    nando_number: null,
    website: 'https://www.kyberturvallisuuskeskus.fi',
    email: null,
    phone: '+358 295 390 230',
    address: 'Traficom, PO Box 313, 00561 Helsinki, Finland',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'telecoms', 'iot'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Part of the Finnish Transport and Communications Agency (Traficom). National EUCC scheme operator.',
  },

  // ── Austria ─────────────────────────────────────────────────
  {
    name: 'A-SIT Zentrum fur sichere Informationstechnologie',
    country: 'AT',
    nando_number: null,
    website: 'https://www.a-sit.at',
    email: 'office@a-sit.at',
    phone: '+43 316 873 5501',
    address: 'Inffeldgasse 16a, 8010 Graz, Austria',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'iot'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Austrian centre for secure information technology. Common Criteria evaluation facility.',
  },

  // ── Poland ──────────────────────────────────────────────────
  {
    name: 'NASK National Research Institute',
    country: 'PL',
    nando_number: null,
    website: 'https://www.nask.pl',
    email: 'info@nask.pl',
    phone: '+48 22 380 82 00',
    address: 'ul. Kolska 12, 01-045 Warsaw, Poland',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking', 'telecoms'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Polish national research institute for cybersecurity. CERT Polska operator.',
  },

  // ── Denmark ─────────────────────────────────────────────────
  {
    name: 'Centre for Cybersecurity (CFCS)',
    country: 'DK',
    nando_number: null,
    website: 'https://www.cfcs.dk',
    email: null,
    phone: '+45 33 32 55 80',
    address: 'Kastellet 30, 2100 Copenhagen, Denmark',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Danish Centre for Cybersecurity under the Defence Intelligence Service.',
  },

  // ── Czech Republic ──────────────────────────────────────────
  {
    name: 'National Cyber and Information Security Agency (NUKIB)',
    country: 'CZ',
    nando_number: null,
    website: 'https://www.nukib.cz',
    email: null,
    phone: '+420 541 110 777',
    address: 'Muckova 1981/9, 612 00 Brno, Czech Republic',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'industrial'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Czech national cybersecurity agency. Common Criteria certification authority.',
  },

  // ── Norway (EEA) ────────────────────────────────────────────
  {
    name: 'Norwegian National Security Authority (NSM)',
    country: 'NO',
    nando_number: null,
    website: 'https://www.nsm.no',
    email: null,
    phone: '+47 67 86 40 00',
    address: 'Kolsas, 1392 Vettre, Norway',
    cra_modules: ['B', 'C'],
    sectors: ['general', 'networking'],
    accreditation_status: 'active',
    accreditation_date: null,
    notes: 'Norwegian national security authority. Common Criteria scheme operator. EEA member, CRA applies via EEA Agreement.',
  },
];

/**
 * Seed the notified_bodies table with initial data.
 * Idempotent — skips entries where name + country already exist.
 */
export async function seedNotifiedBodies(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const body of SEED_BODIES) {
    // Check if already exists (by name + country)
    const existing = await pool.query(
      'SELECT id FROM notified_bodies WHERE name = $1 AND country = $2',
      [body.name, body.country]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO notified_bodies
       (name, country, nando_number, website, email, phone, address,
        cra_modules, sectors, accreditation_status, accreditation_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        body.name,
        body.country,
        body.nando_number,
        body.website,
        body.email,
        body.phone,
        body.address,
        JSON.stringify(body.cra_modules),
        JSON.stringify(body.sectors),
        body.accreditation_status,
        body.accreditation_date,
        body.notes,
      ]
    );
    inserted++;
  }

  console.log(`[NOTIFIED-BODIES] Seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
  return { inserted, skipped };
}
