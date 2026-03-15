/**
 * Admin Analytics Route Tests — /api/admin/analytics
 *
 * Tests: auth enforcement, response structure, data types
 *
 * Requires platform admin role.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/admin/analytics', () => {
  let platformToken: string;
  let adminToken: string;

  beforeAll(async () => {
    platformToken = await loginTestUser(TEST_USERS.platformAdmin);
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  it('should reject unauthenticated request', async () => {
    const res = await api.get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('should reject non-platform-admin request', async () => {
    const res = await api.get('/api/admin/analytics', { auth: adminToken });
    expect([401, 403]).toContain(res.status);
  });

  it('should return analytics data for platform admin', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('should include snapshot section with expected fields', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { snapshot } = res.body;
    expect(snapshot).toBeDefined();
    expect(typeof snapshot.totalUsers).toBe('number');
    expect(typeof snapshot.totalOrgs).toBe('number');
    expect(typeof snapshot.totalProducts).toBe('number');
    expect(typeof snapshot.connectedRepos).toBe('number');
    expect(typeof snapshot.productsWithSboms).toBe('number');
    expect(typeof snapshot.activeUsers7d).toBe('number');
    expect(typeof snapshot.activeUsers30d).toBe('number');
    expect(typeof snapshot.totalContributors).toBe('number');
  });

  it('should include growth section with arrays', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { growth } = res.body;
    expect(growth).toBeDefined();
    expect(Array.isArray(growth.weeklySignups)).toBe(true);
    expect(Array.isArray(growth.cumulativeUsers)).toBe(true);
  });

  it('should include revenue section', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { revenue } = res.body;
    expect(revenue).toBeDefined();
    expect(typeof revenue.mrrCents).toBe('number');
    expect(typeof revenue.byPlan).toBe('object');
    expect(typeof revenue.byStatus).toBe('object');
  });

  it('should include market section with arrays', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { market } = res.body;
    expect(market).toBeDefined();
    expect(Array.isArray(market.countries)).toBe(true);
    expect(Array.isArray(market.industries)).toBe(true);
    expect(Array.isArray(market.roles)).toBe(true);
    expect(Array.isArray(market.companySizes)).toBe(true);
  });

  it('should include assessments section', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { assessments } = res.body;
    expect(assessments).toBeDefined();
    expect(assessments.cra).toBeDefined();
    expect(typeof assessments.cra.total).toBe('number');
    expect(typeof assessments.cra.completed).toBe('number');
    expect(assessments.nis2).toBeDefined();
    expect(typeof assessments.nis2.total).toBe('number');
    expect(typeof assessments.nis2.completed).toBe('number');
  });

  it('should have non-negative snapshot values', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { snapshot } = res.body;
    expect(snapshot.totalUsers).toBeGreaterThanOrEqual(0);
    expect(snapshot.totalOrgs).toBeGreaterThanOrEqual(0);
    expect(snapshot.totalProducts).toBeGreaterThanOrEqual(0);
    expect(snapshot.connectedRepos).toBeGreaterThanOrEqual(0);
  });

  it('should have non-negative MRR', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);
    expect(res.body.revenue.mrrCents).toBeGreaterThanOrEqual(0);
  });

  it('should include nbAssessments section', async () => {
    const res = await api.get('/api/admin/analytics', { auth: platformToken });
    expect(res.status).toBe(200);

    const { nbAssessments } = res.body;
    expect(nbAssessments).toBeDefined();
    expect(typeof nbAssessments.total).toBe('number');
    expect(nbAssessments.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(nbAssessments.byStatus)).toBe(true);
    expect(Array.isArray(nbAssessments.byModule)).toBe(true);
  });
});
