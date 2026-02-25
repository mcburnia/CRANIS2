import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

/**
 * Generate a CycloneDX 1.6 JSON object for a product.
 * Extracted from sbom-export.ts for reuse by due-diligence export.
 */
export async function generateCycloneDX(orgId: string, productId: string): Promise<{ cyclonedx: any; componentCount: number }> {
  const neo4jSession = getDriver().session();

  try {
    // 1. Get product + org data
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p, o`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult.records[0].get('p').properties;
    const org = productResult.records[0].get('o').properties;

    // 2. Check SBOM exists
    const sbomRow = await pool.query(
      'SELECT spdx_json FROM product_sboms WHERE product_id = $1',
      [productId]
    );
    if (sbomRow.rows.length === 0) {
      throw new Error('No SBOM available');
    }

    // 3. Get all dependencies from Neo4j
    const depsResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d ORDER BY d.name`,
      { productId }
    );

    // 4. Get SPDX relationships for dependency tree
    const spdxJson = typeof sbomRow.rows[0].spdx_json === 'string'
      ? JSON.parse(sbomRow.rows[0].spdx_json)
      : sbomRow.rows[0].spdx_json;
    const relationships = spdxJson?.sbom?.relationships || [];
    const spdxPackages = spdxJson?.sbom?.packages || [];

    const spdxIdToPurl = new Map<string, string>();
    for (const pkg of spdxPackages) {
      const purlRef = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl');
      if (purlRef && pkg.SPDXID) {
        spdxIdToPurl.set(pkg.SPDXID, purlRef.referenceLocator);
      }
    }

    // 5. Build CycloneDX components
    const components = depsResult.records.map(record => {
      const d = record.get('d').properties;
      const component: any = {
        type: 'library',
        name: d.name,
        version: d.version || '',
        purl: d.purl,
        'bom-ref': d.purl,
      };

      if (d.hash && d.hashAlgorithm) {
        component.hashes = [{ alg: d.hashAlgorithm, content: d.hash }];
      }

      if (d.license && d.license !== 'NOASSERTION') {
        component.licenses = [{ license: { id: d.license } }];
      }

      if (d.supplier) {
        component.supplier = { name: d.supplier };
      }

      return component;
    });

    // 6. Build dependency tree
    const dependencyMap = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.relationshipType === 'DEPENDS_ON') {
        const fromPurl = spdxIdToPurl.get(rel.spdxElementId);
        const toPurl = spdxIdToPurl.get(rel.relatedSpdxElement);
        if (fromPurl && toPurl) {
          if (!dependencyMap.has(fromPurl)) dependencyMap.set(fromPurl, []);
          dependencyMap.get(fromPurl)!.push(toPurl);
        }
      }
    }

    const dependencies = Array.from(dependencyMap.entries()).map(([ref, dependsOn]) => ({
      ref, dependsOn,
    }));

    // 7. Build manufacturer contacts
    const contacts: any[] = [];
    if (org.contactEmail || org.contactPhone) {
      contacts.push({
        name: org.name,
        ...(org.contactEmail ? { email: org.contactEmail } : {}),
        ...(org.contactPhone ? { phone: org.contactPhone } : {}),
      });
    }

    // 8. Assemble CycloneDX 1.6
    const cyclonedx: any = {
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      serialNumber: `urn:uuid:${uuidv4()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: {
          components: [{
            type: 'application',
            name: 'CRANIS2',
            version: '1.0.0',
            description: 'CRA/NIS2 Compliance Platform',
          }],
        },
        component: {
          type: 'application',
          name: product.name,
          version: product.version || '',
          ...(product.description ? { description: product.description } : {}),
        },
        manufacture: {
          name: org.name,
          ...(org.website ? { url: [org.website] } : {}),
          ...(contacts.length > 0 ? { contact: contacts } : {}),
        },
      },
      components,
      dependencies,
    };

    return { cyclonedx, componentCount: components.length };
  } finally {
    await neo4jSession.close();
  }
}
