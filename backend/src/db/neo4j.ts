import neo4j, { Driver } from 'neo4j-driver';

let driver: Driver;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://neo4j:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4j';
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function initGraph() {
  const session = getDriver().session();
  try {
    // Unique constraint on Organisation name per tenant
    await session.run(`
      CREATE CONSTRAINT org_id_unique IF NOT EXISTS
      FOR (o:Organisation) REQUIRE o.id IS UNIQUE
    `);

    // Index on Organisation name for lookups
    await session.run(`
      CREATE INDEX org_name_idx IF NOT EXISTS
      FOR (o:Organisation) ON (o.name)
    `);

    // Future-proofing: Product node constraint
    await session.run(`
      CREATE CONSTRAINT product_id_unique IF NOT EXISTS
      FOR (p:Product) REQUIRE p.id IS UNIQUE
    `);

    // Dependency node constraint
    await session.run(`
      CREATE CONSTRAINT dependency_id_unique IF NOT EXISTS
      FOR (d:Dependency) REQUIRE d.id IS UNIQUE
    `);

    // Vulnerability node constraint
    await session.run(`
      CREATE CONSTRAINT vulnerability_cve_unique IF NOT EXISTS
      FOR (v:Vulnerability) REQUIRE v.cve IS UNIQUE
    `);

    console.log('Neo4j graph schema initialized');
  } finally {
    await session.close();
  }
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
  }
}
