/**
 * Demo data for CRANIS2 E2E tests.
 *
 * Themed fictional organisations, stakeholders, and products used for
 * UI testing. More engaging than generic "TestOrg" names and produces
 * presentable screenshots and reports.
 *
 * Note: The existing seed data (test-helpers.ts) remains untouched for
 * the 829 Vitest API tests. This demo data is used by Playwright tests
 * when creating, editing, or verifying UI content.
 */

export const DEMO_ORGS = [
  {
    id: 'org-bedrock-industries',
    name: 'Bedrock Industries Ltd',
    franchise: 'The Flintstones',
    sector: 'Entertainment / Media',
    jurisdiction: 'Test Realm (Prehistoric)',
    type: 'Digital Product Manufacturer',
  },
  {
    id: 'org-addams-holdings',
    name: 'Addams Holdings',
    franchise: 'The Addams Family',
    sector: 'Private Family Office',
    jurisdiction: 'Undisclosed',
    type: 'High-Risk / High-Resilience',
  },
  {
    id: 'org-bikini-bottom-services',
    name: 'Bikini Bottom Services Inc',
    franchise: 'SpongeBob SquarePants',
    sector: 'Hospitality / Services',
    jurisdiction: 'International Waters',
    type: 'SME Service Provider',
  },
  {
    id: 'org-heeler-family-studios',
    name: 'Heeler Family Studios',
    franchise: 'Bluey',
    sector: 'Education / Media',
    jurisdiction: 'Australia',
    type: 'Micro Enterprise',
  },
  {
    id: 'org-secret-service-division',
    name: 'Secret Service Division (SSD)',
    franchise: 'Danger Mouse',
    sector: 'Defence / Intelligence',
    jurisdiction: 'United Kingdom',
    type: 'Regulated Operator',
  },
  {
    id: 'org-duckula-enterprises',
    name: 'Duckula Enterprises',
    franchise: 'Count Duckula',
    sector: 'Legacy Estates / IP Holdings',
    jurisdiction: 'Test Realm (Transylvania)',
    type: 'Legacy to Digital Transition',
  },
  {
    id: 'org-springfield-nuclear',
    name: 'Springfield Nuclear Technologies',
    franchise: 'The Simpsons',
    sector: 'Energy / Utilities',
    jurisdiction: 'United States',
    type: 'Critical Infrastructure Adjacent',
  },
  {
    id: 'org-mystery-inc',
    name: 'Mystery Inc.',
    franchise: 'Scooby-Doo',
    sector: 'Investigation / Consulting',
    jurisdiction: 'Multi-Jurisdictional',
    type: 'SME Consultancy',
  },
] as const;

export const DEMO_STAKEHOLDERS = [
  { id: 'stk-fred-flintstone', name: 'Fred Flintstone', orgId: 'org-bedrock-industries', role: 'Managing Director', tag: 'Executive Sponsor' },
  { id: 'stk-wilma-flintstone', name: 'Wilma Flintstone', orgId: 'org-bedrock-industries', role: 'Operations Lead', tag: 'Product Owner' },
  { id: 'stk-gomez-addams', name: 'Gomez Addams', orgId: 'org-addams-holdings', role: 'CEO', tag: 'Executive Sponsor' },
  { id: 'stk-wednesday-addams', name: 'Wednesday Addams', orgId: 'org-addams-holdings', role: 'Security Analyst', tag: 'Red Team' },
  { id: 'stk-spongebob', name: 'SpongeBob SquarePants', orgId: 'org-bikini-bottom-services', role: 'Junior Engineer', tag: 'Service Operator' },
  { id: 'stk-mr-krabs', name: 'Mr Krabs', orgId: 'org-bikini-bottom-services', role: 'CEO', tag: 'Financial Owner' },
  { id: 'stk-bandit-heeler', name: 'Bandit Heeler', orgId: 'org-heeler-family-studios', role: 'Founder', tag: 'Executive Sponsor' },
  { id: 'stk-danger-mouse', name: 'Danger Mouse', orgId: 'org-secret-service-division', role: 'Lead Operative', tag: 'Product Owner' },
  { id: 'stk-homer-simpson', name: 'Homer Simpson', orgId: 'org-springfield-nuclear', role: 'Senior Operator', tag: 'Privileged User' },
  { id: 'stk-velma-dinkley', name: 'Velma Dinkley', orgId: 'org-mystery-inc', role: 'Lead Analyst', tag: 'Technical Authority' },
] as const;

export const DEMO_PRODUCTS = [
  { id: 'prd-rockos', orgId: 'org-bedrock-industries', name: 'RockOS', version: '1.0.0', type: 'Platform' },
  { id: 'prd-vaultos', orgId: 'org-addams-holdings', name: 'VaultOS', version: '2.3.1', type: 'Secure Platform' },
  { id: 'prd-krabbycloud-pos', orgId: 'org-bikini-bottom-services', name: 'KrabbyCloud POS', version: '3.2.0', type: 'Application' },
  { id: 'prd-playlearn', orgId: 'org-heeler-family-studios', name: 'PlayLearn Platform', version: '0.8.0', type: 'Educational Platform' },
  { id: 'prd-agentops', orgId: 'org-secret-service-division', name: 'AgentOps Platform', version: '5.0.0', type: 'Operational Platform' },
  { id: 'prd-nukecore', orgId: 'org-springfield-nuclear', name: 'NukeCore Control System', version: '7.1.0', type: 'Industrial Control System' },
  { id: 'prd-mysterytrack', orgId: 'org-mystery-inc', name: 'MysteryTrack Case System', version: '1.0.0', type: 'Case Management' },
] as const;

/**
 * Get a random demo product name for test data creation.
 * Appends a timestamp to ensure uniqueness.
 */
export function demoProductName(): string {
  const product = DEMO_PRODUCTS[Math.floor(Math.random() * DEMO_PRODUCTS.length)];
  return `${product.name}-${Date.now()}`;
}

/**
 * Get a random demo stakeholder for form testing.
 */
export function demoStakeholder() {
  return DEMO_STAKEHOLDERS[Math.floor(Math.random() * DEMO_STAKEHOLDERS.length)];
}

/**
 * Get a random demo org name for form testing.
 */
export function demoOrgName(): string {
  const org = DEMO_ORGS[Math.floor(Math.random() * DEMO_ORGS.length)];
  return org.name;
}
