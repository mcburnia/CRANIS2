/**
 * Market Surveillance Authorities — Seed Data
 *
 * National market surveillance authorities responsible for CRA enforcement
 * across EU member states and EEA countries. Under CRA Art. 45, each member
 * state designates one or more market surveillance authorities for products
 * with digital elements.
 *
 * Data source: EU Market Surveillance Regulation (EU) 2019/1020, national
 * government publications, ICSMS database, and member state notifications.
 * Last reviewed: 2026-03-15
 *
 * Note: CRA-specific designations are still being finalised by member states.
 * This seed provides the most likely authorities based on existing mandates.
 * Admins can update entries as official designations are published.
 */

import pool from '../db/pool.js';

export interface MarketSurveillanceAuthoritySeed {
  name: string;
  country: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  competence_areas: string[];
  cra_designated: boolean;
  contact_portal_url: string | null;
  notes: string | null;
}

const SEED_AUTHORITIES: MarketSurveillanceAuthoritySeed[] = [
  // ── Germany ─────────────────────────────────────────────────
  {
    name: 'Bundesnetzagentur (BNetzA)',
    country: 'DE',
    website: 'https://www.bundesnetzagentur.de',
    email: null,
    phone: '+49 228 14 0',
    address: 'Tulpenfeld 4, 53113 Bonn, Germany',
    competence_areas: ['cybersecurity', 'telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: 'https://www.bundesnetzagentur.de/cln_1412/DE/Sachgebiete/Telekommunikation/Unternehmen_Institutionen/Marktbeobachtung/start.html',
    notes: 'Federal Network Agency. Primary market surveillance authority for radio equipment, telecoms, and connected devices in Germany. Expected lead authority for CRA enforcement.',
  },
  {
    name: 'Bundesamt fur Sicherheit in der Informationstechnik (BSI)',
    country: 'DE',
    website: 'https://www.bsi.bund.de',
    email: null,
    phone: '+49 228 99 9582 0',
    address: 'Godesberger Allee 185-189, 53175 Bonn, Germany',
    competence_areas: ['cybersecurity', 'general', 'industrial', 'networking'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Federal Office for Information Security. National cybersecurity authority with technical assessment capability. Co-designated for CRA market surveillance alongside BNetzA.',
  },

  // ── France ──────────────────────────────────────────────────
  {
    name: 'Direction generale de la concurrence, de la consommation et de la repression des fraudes (DGCCRF)',
    country: 'FR',
    website: 'https://www.economie.gouv.fr/dgccrf',
    email: null,
    phone: '+33 1 44 97 17 17',
    address: '59 boulevard Vincent Auriol, 75013 Paris, France',
    competence_areas: ['consumer_electronics', 'general', 'iot'],
    cra_designated: true,
    contact_portal_url: 'https://signal.conso.gouv.fr',
    notes: 'Directorate-General for Competition, Consumer Affairs, and Fraud Control. France\'s primary market surveillance authority for consumer products.',
  },
  {
    name: 'Agence nationale de la securite des systemes d\'information (ANSSI)',
    country: 'FR',
    website: 'https://www.ssi.gouv.fr',
    email: null,
    phone: '+33 1 71 75 82 82',
    address: '51 boulevard de La Tour-Maubourg, 75700 Paris, France',
    competence_areas: ['cybersecurity', 'networking', 'industrial', 'telecoms'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'National cybersecurity agency. Technical authority for cybersecurity aspects of CRA market surveillance. Works alongside DGCCRF.',
  },

  // ── Netherlands ─────────────────────────────────────────────
  {
    name: 'Rijksinspectie Digitale Infrastructuur (RDI)',
    country: 'NL',
    website: 'https://www.rdi.nl',
    email: 'info@rdi.nl',
    phone: '+31 70 889 71 00',
    address: 'Zurichtoren, Muzenstraat 41, 2511 WB The Hague, Netherlands',
    competence_areas: ['cybersecurity', 'telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: 'https://www.rdi.nl/melden',
    notes: 'National Inspectorate for Digital Infrastructure (formerly Agentschap Telecom). Designated for market surveillance of connected products and cybersecurity compliance.',
  },

  // ── Belgium ─────────────────────────────────────────────────
  {
    name: 'Belgian Institute for Postal Services and Telecommunications (BIPT)',
    country: 'BE',
    website: 'https://www.bipt.be',
    email: 'info@bipt.be',
    phone: '+32 2 226 88 88',
    address: 'Boulevard du Roi Albert II 35, 1030 Brussels, Belgium',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Regulator for electronic communications and postal services. Market surveillance for radio equipment and connected devices.',
  },

  // ── Spain ───────────────────────────────────────────────────
  {
    name: 'Secretaria de Estado de Telecomunicaciones e Infraestructuras Digitales',
    country: 'ES',
    website: 'https://avancedigital.mineco.gob.es',
    email: null,
    phone: '+34 91 346 15 40',
    address: 'Paseo de la Castellana 162, 28046 Madrid, Spain',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics', 'cybersecurity'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'State Secretariat for Telecommunications and Digital Infrastructure. Primary authority for CRA market surveillance in Spain.',
  },

  // ── Italy ───────────────────────────────────────────────────
  {
    name: 'Ministero delle Imprese e del Made in Italy (MIMIT)',
    country: 'IT',
    website: 'https://www.mimit.gov.it',
    email: null,
    phone: '+39 06 4705 1',
    address: 'Via Molise 2, 00187 Rome, Italy',
    competence_areas: ['consumer_electronics', 'general', 'industrial', 'iot'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Ministry of Enterprises and Made in Italy. Responsible for market surveillance of industrial and consumer products including digital elements.',
  },
  {
    name: 'Agenzia per la Cybersicurezza Nazionale (ACN)',
    country: 'IT',
    website: 'https://www.acn.gov.it',
    email: null,
    phone: '+39 06 8209 8000',
    address: 'Via Santa Susanna 15, 00187 Rome, Italy',
    competence_areas: ['cybersecurity', 'networking', 'telecoms'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'National Cybersecurity Agency. Technical authority for cybersecurity aspects of CRA enforcement.',
  },

  // ── Sweden ──────────────────────────────────────────────────
  {
    name: 'Post- och telestyrelsen (PTS)',
    country: 'SE',
    website: 'https://www.pts.se',
    email: 'pts@pts.se',
    phone: '+46 8 678 55 00',
    address: 'Box 5398, 102 49 Stockholm, Sweden',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Swedish Post and Telecom Authority. Market surveillance for radio equipment and electronic communications products.',
  },

  // ── Finland ─────────────────────────────────────────────────
  {
    name: 'Liikenne- ja viestintavirasto Traficom',
    country: 'FI',
    website: 'https://www.traficom.fi',
    email: null,
    phone: '+358 295 345 000',
    address: 'PO Box 320, 00059 Traficom, Helsinki, Finland',
    competence_areas: ['telecoms', 'networking', 'iot', 'cybersecurity', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Finnish Transport and Communications Agency. Designated for CRA market surveillance. Also hosts the NCSC-FI cybersecurity centre.',
  },

  // ── Austria ─────────────────────────────────────────────────
  {
    name: 'Fernmeldeburo (FMB)',
    country: 'AT',
    website: 'https://www.bmf.gv.at',
    email: null,
    phone: '+43 50 233 0',
    address: 'Radetzkystrasse 2, 1030 Vienna, Austria',
    competence_areas: ['telecoms', 'networking', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Austrian telecommunications office. Market surveillance for radio equipment and connected products.',
  },

  // ── Poland ──────────────────────────────────────────────────
  {
    name: 'Urzad Komunikacji Elektronicznej (UKE)',
    country: 'PL',
    website: 'https://www.uke.gov.pl',
    email: 'uke@uke.gov.pl',
    phone: '+48 22 534 91 00',
    address: 'ul. Gielen 12A, 01-014 Warsaw, Poland',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Office of Electronic Communications. Primary market surveillance authority for electronic and connected products in Poland.',
  },

  // ── Denmark ─────────────────────────────────────────────────
  {
    name: 'Sikkerhedsstyrelsen (Danish Safety Technology Authority)',
    country: 'DK',
    website: 'https://www.sik.dk',
    email: 'sik@sik.dk',
    phone: '+45 33 73 20 00',
    address: 'Norre Voldgade 48, 1358 Copenhagen K, Denmark',
    competence_areas: ['consumer_electronics', 'general', 'iot', 'industrial'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Danish Safety Technology Authority. Market surveillance for product safety including connected devices.',
  },

  // ── Czech Republic ──────────────────────────────────────────
  {
    name: 'Cesky telekomunikacni urad (CTU)',
    country: 'CZ',
    website: 'https://www.ctu.cz',
    email: 'podatelna@ctu.cz',
    phone: '+420 224 004 111',
    address: 'Sokolovska 219, 190 00 Prague 9, Czech Republic',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Czech Telecommunication Office. Market surveillance for electronic communications equipment.',
  },

  // ── Ireland ─────────────────────────────────────────────────
  {
    name: 'Commission for Communications Regulation (ComReg)',
    country: 'IE',
    website: 'https://www.comreg.ie',
    email: 'consumerline@comreg.ie',
    phone: '+353 1 804 9600',
    address: 'One Dockland Central, Guild Street, Dublin 1, Ireland',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Irish communications regulator. Market surveillance for radio equipment and connected products.',
  },

  // ── Portugal ────────────────────────────────────────────────
  {
    name: 'Autoridade Nacional de Comunicacoes (ANACOM)',
    country: 'PT',
    website: 'https://www.anacom.pt',
    email: 'info@anacom.pt',
    phone: '+351 21 721 10 00',
    address: 'Av. Jose Malhoa 12, 1099-017 Lisbon, Portugal',
    competence_areas: ['telecoms', 'networking', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Portuguese national communications authority. Market surveillance for electronic communications equipment.',
  },

  // ── Greece ──────────────────────────────────────────────────
  {
    name: 'Ethnike Epitrope Tilepikoinonion kai Tachydromeion (EETT)',
    country: 'GR',
    website: 'https://www.eett.gr',
    email: 'info@eett.gr',
    phone: '+30 210 615 1000',
    address: 'Maroussi, 151 25 Athens, Greece',
    competence_areas: ['telecoms', 'networking', 'consumer_electronics'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Hellenic Telecommunications and Post Commission. Market surveillance for telecoms and connected products.',
  },

  // ── Norway (EEA) ────────────────────────────────────────────
  {
    name: 'Nasjonal kommunikasjonsmyndighet (Nkom)',
    country: 'NO',
    website: 'https://www.nkom.no',
    email: 'firmapost@nkom.no',
    phone: '+47 22 82 46 00',
    address: 'Lillekort, 4790 Lillesand, Norway',
    competence_areas: ['telecoms', 'networking', 'iot', 'consumer_electronics', 'cybersecurity'],
    cra_designated: true,
    contact_portal_url: null,
    notes: 'Norwegian Communications Authority. Market surveillance for electronic communications. CRA applies via EEA Agreement.',
  },
];

/**
 * Seed the market_surveillance_authorities table with initial data.
 * Idempotent — skips entries where name + country already exist.
 */
export async function seedMarketSurveillanceAuthorities(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const authority of SEED_AUTHORITIES) {
    const existing = await pool.query(
      'SELECT id FROM market_surveillance_authorities WHERE name = $1 AND country = $2',
      [authority.name, authority.country]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO market_surveillance_authorities
       (name, country, website, email, phone, address,
        competence_areas, cra_designated, contact_portal_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        authority.name,
        authority.country,
        authority.website,
        authority.email,
        authority.phone,
        authority.address,
        JSON.stringify(authority.competence_areas),
        authority.cra_designated,
        authority.contact_portal_url,
        authority.notes,
      ]
    );
    inserted++;
  }

  console.log(`[MARKET-SURVEILLANCE] Seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
  return { inserted, skipped };
}
