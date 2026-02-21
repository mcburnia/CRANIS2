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
    // --- Core business nodes ---
    await session.run(`CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (o:Organisation) REQUIRE o.id IS UNIQUE`);
    await session.run(`CREATE INDEX org_name_idx IF NOT EXISTS FOR (o:Organisation) ON (o.name)`);
    await session.run(`CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT dependency_id_unique IF NOT EXISTS FOR (d:Dependency) REQUIRE d.id IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT dependency_purl_unique IF NOT EXISTS FOR (d:Dependency) REQUIRE d.purl IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT vulnerability_cve_unique IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.cve IS UNIQUE`);

    await session.run(`CREATE CONSTRAINT techfile_product_unique IF NOT EXISTS FOR (tf:TechnicalFile) REQUIRE tf.productId IS UNIQUE`);

    // --- Telemetry nodes ---
    await session.run(`CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT email_domain_unique IF NOT EXISTS FOR (d:EmailDomain) REQUIRE d.domain IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT ip_address_unique IF NOT EXISTS FOR (ip:IPAddress) REQUIRE ip.ip IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT device_fp_unique IF NOT EXISTS FOR (dev:Device) REQUIRE dev.fingerprint IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT language_code_unique IF NOT EXISTS FOR (l:Language) REQUIRE l.code IS UNIQUE`);

    // --- Indexes for querying ---
    await session.run(`CREATE INDEX event_type_idx IF NOT EXISTS FOR (e:Event) ON (e.type)`);
    await session.run(`CREATE INDEX event_created_idx IF NOT EXISTS FOR (e:Event) ON (e.createdAt)`);
    await session.run(`CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)`);

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
