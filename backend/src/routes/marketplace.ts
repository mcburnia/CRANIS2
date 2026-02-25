import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { computeComplianceBadges } from '../services/marketplace.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';

const router = Router();

// ── Auth middleware (per-route pattern) ──

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// ── Static categories ──

const MARKETPLACE_CATEGORIES = [
  { value: 'iot', label: 'IoT & Connected Devices' },
  { value: 'industrial', label: 'Industrial & Manufacturing' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'healthcare', label: 'Healthcare & MedTech' },
  { value: 'fintech', label: 'FinTech & Financial Services' },
  { value: 'enterprise', label: 'Enterprise Software' },
  { value: 'open_source', label: 'Open Source' },
  { value: 'saas', label: 'SaaS & Cloud' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'other', label: 'Other' },
];

const VALID_CATEGORIES = new Set(MARKETPLACE_CATEGORIES.map(c => c.value));

// ═══════════════════════════════════════════════
// PUBLIC — No auth required
// ═══════════════════════════════════════════════

// GET /api/marketplace/categories — Must be before /:orgId
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: MARKETPLACE_CATEGORIES });
});

// GET /api/marketplace/listings — Public browse
router.get('/listings', async (req: Request, res: Response) => {
  try {
    const { country, industry, craRole, category, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;

    // Get listed profiles from Postgres
    let whereClause = 'WHERE mp.listed = true AND mp.listing_approved = true';
    const params: any[] = [];
    let paramIdx = 1;

    if (category) {
      whereClause += ` AND mp.categories @> $${paramIdx}::jsonb`;
      params.push(JSON.stringify([category]));
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM marketplace_profiles mp ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const profileResult = await pool.query(
      `SELECT mp.* FROM marketplace_profiles mp ${whereClause}
       ORDER BY mp.contact_requests_count DESC, mp.created_at ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    if (profileResult.rows.length === 0) {
      res.json({ listings: [], total, page, limit });
      return;
    }

    // Collect org IDs
    const orgIds = profileResult.rows.map(r => r.org_id.toString());

    // Batch fetch org data from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let orgMap = new Map<string, any>();
    let productMap = new Map<string, any[]>();

    try {
      // Fetch orgs
      const orgResult = await session.run(
        `UNWIND $orgIds AS oid
         MATCH (o:Organisation {id: oid})
         RETURN o.id AS id, o.name AS name, o.country AS country,
                o.industry AS industry, o.craRole AS craRole,
                o.companySize AS companySize, o.website AS website`,
        { orgIds }
      );
      for (const r of orgResult.records) {
        orgMap.set(r.get('id'), {
          name: r.get('name'),
          country: r.get('country'),
          industry: r.get('industry'),
          craRole: r.get('craRole'),
          companySize: r.get('companySize'),
          website: r.get('website'),
        });
      }

      // Fetch products for all listed orgs
      const prodResult = await session.run(
        `UNWIND $orgIds AS oid
         MATCH (o:Organisation {id: oid})<-[:BELONGS_TO]-(p:Product)
         RETURN o.id AS orgId, p.id AS id, p.name AS name,
                p.description AS description, p.productType AS productType,
                p.craCategory AS craCategory`,
        { orgIds }
      );
      for (const r of prodResult.records) {
        const orgId = r.get('orgId');
        if (!productMap.has(orgId)) productMap.set(orgId, []);
        productMap.get(orgId)!.push({
          id: r.get('id'),
          name: r.get('name'),
          description: r.get('description'),
          productType: r.get('productType'),
          craCategory: r.get('craCategory'),
        });
      }
    } finally {
      await session.close();
    }

    // Apply Neo4j-level filters
    let listings = profileResult.rows.map(row => {
      const orgId = row.org_id.toString();
      const org = orgMap.get(orgId) || {};
      const featuredIds = row.featured_product_ids || [];
      const allProducts = productMap.get(orgId) || [];
      const products = featuredIds.length > 0
        ? allProducts.filter((p: any) => featuredIds.includes(p.id))
        : allProducts;

      return {
        orgId,
        orgName: org.name || 'Unknown',
        country: org.country || '',
        industry: org.industry || '',
        craRole: org.craRole || '',
        companySize: org.companySize || '',
        website: org.website || '',
        tagline: row.tagline,
        description: row.description,
        logoUrl: row.logo_url,
        categories: row.categories || [],
        complianceBadges: row.compliance_badges || {},
        products,
        productCount: allProducts.length,
        listedAt: row.created_at,
      };
    });

    // Apply text search filter
    if (search) {
      const s = (search as string).toLowerCase();
      listings = listings.filter(l =>
        l.orgName.toLowerCase().includes(s) ||
        l.tagline.toLowerCase().includes(s) ||
        l.description.toLowerCase().includes(s)
      );
    }

    // Apply Neo4j-level filters
    if (country) {
      listings = listings.filter(l => l.country?.toLowerCase() === (country as string).toLowerCase());
    }
    if (industry) {
      listings = listings.filter(l => l.industry?.toLowerCase() === (industry as string).toLowerCase());
    }
    if (craRole) {
      listings = listings.filter(l => l.craRole === craRole);
    }

    res.json({ listings, total: listings.length, page, limit });
  } catch (err) {
    console.error('[MARKETPLACE] Failed to fetch listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/marketplace/listings/:orgId — Single company detail
router.get('/listings/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  try {
    const profile = await pool.query(
      'SELECT * FROM marketplace_profiles WHERE org_id = $1 AND listed = true AND listing_approved = true',
      [orgId]
    );
    if (profile.rows.length === 0) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    const row = profile.rows[0];

    // Fetch org + products from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let org: any = {};
    let products: any[] = [];

    try {
      const orgResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})
         RETURN o.name AS name, o.country AS country, o.industry AS industry,
                o.craRole AS craRole, o.companySize AS companySize, o.website AS website`,
        { orgId: orgId as string }
      );
      if (orgResult.records.length > 0) {
        const r = orgResult.records[0];
        org = {
          name: r.get('name'), country: r.get('country'), industry: r.get('industry'),
          craRole: r.get('craRole'), companySize: r.get('companySize'), website: r.get('website'),
        };
      }

      const prodResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p.id AS id, p.name AS name, p.description AS description,
                p.productType AS productType, p.craCategory AS craCategory`,
        { orgId: orgId as string }
      );
      products = prodResult.records.map(r => ({
        id: r.get('id'), name: r.get('name'), description: r.get('description'),
        productType: r.get('productType'), craCategory: r.get('craCategory'),
      }));
    } finally {
      await session.close();
    }

    const featuredIds = row.featured_product_ids || [];
    const featuredProducts = featuredIds.length > 0
      ? products.filter((p: any) => featuredIds.includes(p.id))
      : products;

    res.json({
      orgId: row.org_id.toString(),
      orgName: org.name || 'Unknown',
      country: org.country || '',
      industry: org.industry || '',
      craRole: org.craRole || '',
      companySize: org.companySize || '',
      website: org.website || '',
      tagline: row.tagline,
      description: row.description,
      logoUrl: row.logo_url,
      categories: row.categories || [],
      complianceBadges: row.compliance_badges || {},
      products: featuredProducts,
      allProductCount: products.length,
      contactRequestsCount: row.contact_requests_count,
      listedAt: row.created_at,
    });
  } catch (err) {
    console.error('[MARKETPLACE] Failed to fetch listing detail:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ═══════════════════════════════════════════════
// AUTHENTICATED — Profile management & contact
// ═══════════════════════════════════════════════

// GET /api/marketplace/profile — Current org's marketplace profile
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const profile = await pool.query(
      'SELECT * FROM marketplace_profiles WHERE org_id = $1',
      [orgId]
    );

    // Also get org's products for the featured selector
    const driver = getDriver();
    const session = driver.session();
    let products: any[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p.id AS id, p.name AS name, p.productType AS productType`,
        { orgId }
      );
      products = result.records.map(r => ({
        id: r.get('id'), name: r.get('name'), productType: r.get('productType'),
      }));
    } finally {
      await session.close();
    }

    if (profile.rows.length === 0) {
      // Return empty profile
      res.json({
        listed: false,
        tagline: '',
        description: '',
        logoUrl: '',
        categories: [],
        featuredProductIds: [],
        complianceBadges: {},
        products,
      });
      return;
    }

    const row = profile.rows[0];
    res.json({
      listed: row.listed,
      tagline: row.tagline,
      description: row.description,
      logoUrl: row.logo_url,
      categories: row.categories || [],
      featuredProductIds: row.featured_product_ids || [],
      complianceBadges: row.compliance_badges || {},
      listingApproved: row.listing_approved,
      contactRequestsCount: row.contact_requests_count,
      products,
    });
  } catch (err) {
    console.error('[MARKETPLACE] Failed to fetch profile:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace profile' });
  }
});

// PUT /api/marketplace/profile — Upsert listing (org admin only)
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Check org admin
    const user = await pool.query('SELECT org_role FROM users WHERE id = $1', [userId]);
    if (user.rows[0]?.org_role !== 'admin') {
      res.status(403).json({ error: 'Only organisation admins can manage the marketplace listing' });
      return;
    }

    const { listed, tagline, description, logoUrl, categories, featuredProductIds } = req.body;

    // Validate
    if (tagline && tagline.length > 160) {
      res.status(400).json({ error: 'Tagline must be 160 characters or less' });
      return;
    }
    if (description && description.length > 2000) {
      res.status(400).json({ error: 'Description must be 2000 characters or less' });
      return;
    }
    if (categories && !Array.isArray(categories)) {
      res.status(400).json({ error: 'Categories must be an array' });
      return;
    }
    if (categories) {
      for (const cat of categories) {
        if (!VALID_CATEGORIES.has(cat)) {
          res.status(400).json({ error: `Invalid category: ${cat}` });
          return;
        }
      }
    }

    // Validate featured products belong to org
    if (featuredProductIds && featuredProductIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const result = await session.run(
          `UNWIND $ids AS pid
           MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: pid})
           RETURN p.id AS id`,
          { orgId, ids: featuredProductIds }
        );
        const validIds = new Set(result.records.map(r => r.get('id')));
        for (const id of featuredProductIds) {
          if (!validIds.has(id)) {
            res.status(400).json({ error: `Product ${id} not found in your organisation` });
            return;
          }
        }
      } finally {
        await session.close();
      }
    }

    // Compute compliance badges
    const badges = await computeComplianceBadges(orgId);

    // Upsert
    await pool.query(
      `INSERT INTO marketplace_profiles (org_id, listed, tagline, description, logo_url, categories, featured_product_ids, compliance_badges)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id) DO UPDATE SET
         listed = $2, tagline = $3, description = $4, logo_url = $5,
         categories = $6, featured_product_ids = $7, compliance_badges = $8,
         updated_at = NOW()`,
      [
        orgId,
        listed ?? false,
        tagline || '',
        description || '',
        logoUrl || '',
        JSON.stringify(categories || []),
        JSON.stringify(featuredProductIds || []),
        JSON.stringify(badges),
      ]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email: (req as any).email,
      eventType: 'marketplace_profile_updated', ...reqData,
      metadata: { orgId, listed },
    });

    res.json({ success: true, complianceBadges: badges });
  } catch (err) {
    console.error('[MARKETPLACE] Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update marketplace profile' });
  }
});

// POST /api/marketplace/contact/:orgId — Send intro email
router.post('/contact/:orgId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const targetOrgId = req.params.orgId as string;

  try {
    const senderOrgId = await getOrgId(userId);
    if (!senderOrgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Can't contact own org
    if (senderOrgId === targetOrgId) {
      res.status(400).json({ error: 'You cannot send an introduction to your own organisation' });
      return;
    }

    // Target must be listed + approved
    const target = await pool.query(
      'SELECT listed, listing_approved FROM marketplace_profiles WHERE org_id = $1',
      [targetOrgId]
    );
    if (target.rows.length === 0 || !target.rows[0].listed || !target.rows[0].listing_approved) {
      res.status(404).json({ error: 'Company not found on marketplace' });
      return;
    }

    // Rate limit: max 3 contacts per day
    const dailyCount = await pool.query(
      `SELECT count(*) FROM marketplace_contact_log
       WHERE from_user_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    if (parseInt(dailyCount.rows[0].count) >= 3) {
      res.status(429).json({ error: 'You can send a maximum of 3 introductions per day' });
      return;
    }

    // Rate limit: max 1 to same org per 7 days
    const orgCount = await pool.query(
      `SELECT count(*) FROM marketplace_contact_log
       WHERE from_user_id = $1 AND to_org_id = $2 AND sent_at > NOW() - INTERVAL '7 days'`,
      [userId, targetOrgId]
    );
    if (parseInt(orgCount.rows[0].count) >= 1) {
      res.status(429).json({ error: 'You have already contacted this company in the last 7 days' });
      return;
    }

    const { message } = req.body;
    if (!message || message.length < 10 || message.length > 1000) {
      res.status(400).json({ error: 'Message must be between 10 and 1000 characters' });
      return;
    }

    // Get sender org name
    const driver = getDriver();
    const session = driver.session();
    let senderOrgName = 'Unknown';
    let targetContactEmail = '';
    let targetOrgName = 'Unknown';
    try {
      const senderResult = await session.run(
        'MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name',
        { orgId: senderOrgId }
      );
      if (senderResult.records.length > 0) senderOrgName = senderResult.records[0].get('name') || senderOrgName;

      const targetResult = await session.run(
        'MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name, o.contactEmail AS contactEmail',
        { orgId: targetOrgId }
      );
      if (targetResult.records.length > 0) {
        targetOrgName = targetResult.records[0].get('name') || targetOrgName;
        targetContactEmail = targetResult.records[0].get('contactEmail') || '';
      }
    } finally {
      await session.close();
    }

    // Fallback to org admin email if no contactEmail
    if (!targetContactEmail) {
      const adminResult = await pool.query(
        `SELECT email FROM users WHERE org_id = $1 AND org_role = 'admin' ORDER BY created_at ASC LIMIT 1`,
        [targetOrgId]
      );
      targetContactEmail = adminResult.rows[0]?.email || '';
    }

    if (!targetContactEmail) {
      res.status(500).json({ error: 'Unable to find contact email for this company' });
      return;
    }

    // Get sender's name
    const senderUser = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const senderEmail = senderUser.rows[0]?.email || email;

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const htmlBody = `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 700; color: #fff;">CRANIS</span><span style="font-size: 24px; font-weight: 700; color: #a78bfa;">2</span>
            <span style="font-size: 14px; color: #888; display: block; margin-top: 4px;">Compliance Marketplace</span>
          </div>
          <div style="background: #252540; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px; color: #fff; font-size: 18px;">New Introduction</h2>
            <p style="margin: 0 0 8px; color: #ccc;">You've received an introduction via the CRANIS2 Compliance Marketplace.</p>
            <div style="background: #1a1a2e; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 4px;"><strong style="color: #a78bfa;">From:</strong> ${senderOrgName}</p>
              <p style="margin: 0 0 4px;"><strong style="color: #a78bfa;">Contact:</strong> ${senderEmail}</p>
            </div>
            <div style="background: #1a1a2e; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px; color: #a78bfa; font-weight: 600;">Message:</p>
              <p style="margin: 0; color: #e0e0e0; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
            <p style="margin: 16px 0 0; color: #888; font-size: 13px;">You can reply directly to this email to respond to ${senderOrgName}.</p>
          </div>
          <p style="text-align: center; color: #666; font-size: 12px;">
            Sent via <a href="https://dev.cranis2.dev/marketplace" style="color: #a78bfa; text-decoration: none;">CRANIS2 Compliance Marketplace</a>
          </p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CRANIS2 Marketplace <info@poste.cranis2.com>',
          to: targetContactEmail,
          reply_to: senderEmail,
          subject: `CRANIS2 Marketplace: Introduction from ${senderOrgName}`,
          html: htmlBody,
        }),
      });
    }

    // Log contact
    await pool.query(
      `INSERT INTO marketplace_contact_log (from_user_id, from_org_id, to_org_id, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, senderOrgId, targetOrgId, message]
    );

    // Increment contact count
    await pool.query(
      `UPDATE marketplace_profiles SET contact_requests_count = contact_requests_count + 1 WHERE org_id = $1`,
      [targetOrgId]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'marketplace_contact_sent', ...reqData,
      metadata: { fromOrgId: senderOrgId, toOrgId: targetOrgId },
    });

    res.json({ success: true, message: `Introduction sent to ${targetOrgName}` });
  } catch (err) {
    console.error('[MARKETPLACE] Failed to send contact:', err);
    res.status(500).json({ error: 'Failed to send introduction' });
  }
});

// GET /api/marketplace/contact-history — Contacts sent by current user
router.get('/contact-history', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT mcl.to_org_id, mcl.message, mcl.sent_at
       FROM marketplace_contact_log mcl
       WHERE mcl.from_user_id = $1
       ORDER BY mcl.sent_at DESC
       LIMIT 50`,
      [userId]
    );

    // Resolve org names
    if (result.rows.length > 0) {
      const orgIds = [...new Set(result.rows.map(r => r.to_org_id.toString()))];
      const driver = getDriver();
      const session = driver.session();
      const orgNames = new Map<string, string>();
      try {
        const neo4jResult = await session.run(
          'UNWIND $orgIds AS oid MATCH (o:Organisation {id: oid}) RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const r of neo4jResult.records) {
          orgNames.set(r.get('id'), r.get('name'));
        }
      } finally {
        await session.close();
      }

      const contacts = result.rows.map(r => ({
        toOrgId: r.to_org_id,
        toOrgName: orgNames.get(r.to_org_id.toString()) || 'Unknown',
        message: r.message,
        sentAt: r.sent_at,
      }));

      res.json({ contacts });
    } else {
      res.json({ contacts: [] });
    }
  } catch (err) {
    console.error('[MARKETPLACE] Failed to fetch contact history:', err);
    res.status(500).json({ error: 'Failed to fetch contact history' });
  }
});

// ═══════════════════════════════════════════════
// ADMIN — Platform admin marketplace controls
// ═══════════════════════════════════════════════

// GET /api/marketplace/admin/overview
router.get('/admin/overview', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT mp.*, (SELECT count(*) FROM marketplace_contact_log WHERE to_org_id = mp.org_id) AS total_contacts
       FROM marketplace_profiles mp
       ORDER BY mp.created_at DESC`
    );

    // Resolve org names
    const orgIds = result.rows.map(r => r.org_id.toString());
    const driver = getDriver();
    const session = driver.session();
    const orgNames = new Map<string, string>();
    try {
      if (orgIds.length > 0) {
        const neo4jResult = await session.run(
          'UNWIND $orgIds AS oid MATCH (o:Organisation {id: oid}) RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const r of neo4jResult.records) {
          orgNames.set(r.get('id'), r.get('name'));
        }
      }
    } finally {
      await session.close();
    }

    const profiles = result.rows.map(row => ({
      orgId: row.org_id,
      orgName: orgNames.get(row.org_id.toString()) || 'Unknown',
      listed: row.listed,
      listingApproved: row.listing_approved,
      tagline: row.tagline,
      categories: row.categories,
      contactRequestsCount: row.contact_requests_count,
      totalContacts: parseInt(row.total_contacts || '0'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const listed = profiles.filter(p => p.listed && p.listingApproved).length;
    const pending = profiles.filter(p => p.listed && !p.listingApproved).length;
    const totalContacts = profiles.reduce((sum, p) => sum + p.totalContacts, 0);

    res.json({
      profiles,
      totals: { total: profiles.length, listed, pending, totalContacts },
    });
  } catch (err) {
    console.error('[MARKETPLACE ADMIN] Failed to fetch overview:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace overview' });
  }
});

// PUT /api/marketplace/admin/:orgId/approve — Toggle listing approval
router.put('/admin/:orgId/approve', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { approved } = req.body;
  try {
    await pool.query(
      'UPDATE marketplace_profiles SET listing_approved = $1, updated_at = NOW() WHERE org_id = $2',
      [!!approved, orgId]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: approved ? 'admin_marketplace_approved' : 'admin_marketplace_disapproved',
      ...reqData, metadata: { orgId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[MARKETPLACE ADMIN] Failed to update approval:', err);
    res.status(500).json({ error: 'Failed to update listing approval' });
  }
});

export default router;
