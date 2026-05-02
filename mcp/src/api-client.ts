/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * CRANIS2 API Client
 * Thin wrapper around the CRANIS2 Public API v1.
 */

const API_URL = process.env.CRANIS2_API_URL || 'https://dev.cranis2.dev';
const API_KEY = process.env.CRANIS2_API_KEY || '';

if (!API_KEY) {
  console.error('[CRANIS2-MCP] CRANIS2_API_KEY environment variable is required');
  process.exit(1);
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CRANIS2 API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function listProducts(): Promise<any[]> {
  const data = await request('/products');
  return data.products;
}

export async function getProduct(productId: string): Promise<any> {
  return request(`/products/${productId}`);
}

export async function getVulnerabilities(
  productId: string,
  severity?: string,
  status?: string,
): Promise<any> {
  const params = new URLSearchParams();
  if (severity) params.set('severity', severity);
  if (status) params.set('status', status);
  const qs = params.toString();
  return request(`/products/${productId}/vulnerabilities${qs ? `?${qs}` : ''}`);
}

export async function getComplianceStatus(
  productId: string,
  threshold?: string,
): Promise<any> {
  const qs = threshold ? `?threshold=${threshold}` : '';
  return request(`/products/${productId}/compliance-status${qs}`);
}

export async function triggerSync(productId: string): Promise<any> {
  return request(`/products/${productId}/sync`, { method: 'POST' });
}

export async function resolveFinding(
  productId: string,
  findingId: string,
  evidence: Record<string, unknown>,
): Promise<any> {
  return request(`/products/${productId}/findings/${findingId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ evidence }),
  });
}

export async function getScanStatus(productId: string, scanId: string): Promise<any> {
  return request(`/products/${productId}/scans/${scanId}`);
}
