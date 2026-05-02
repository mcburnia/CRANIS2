/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Centralised CSS selectors for CRANIS2 E2E tests.
 * These will be refined during test implementation as we discover actual DOM structure.
 */

export const SEL = {
  // ── Login page ──
  loginEmail: 'input[type="email"]',
  loginPassword: 'input[type="password"]',
  loginSubmit: 'button[type="submit"]',
  loginError: '[class*="error"]',

  // ── Sidebar navigation ──
  sidebar: 'nav',
  sidebarSection: '[class*="sidebar-section"], [class*="accordion"]',

  // ── Common page elements ──
  pageHeader: '[class*="page-header"], h1, h2',
  statCard: '[class*="stat-card"], [class*="stat"]',
  loadingSpinner: '[class*="loading"], [class*="spinner"]',
  emptyState: '[class*="empty"], [class*="no-data"]',

  // ── Forms ──
  submitButton: 'button[type="submit"]',
  saveButton: 'button:has-text("Save")',
  cancelButton: 'button:has-text("Cancel")',
  deleteButton: 'button:has-text("Delete")',
  confirmButton: 'button:has-text("Confirm")',

  // ── Tables ──
  tableRow: 'tr, [class*="row"]',
  tableHeader: 'th, [class*="header"]',

  // ── Notifications ──
  notificationBadge: '[class*="badge"], [class*="count"]',

  // ── Modals ──
  modal: '[class*="modal"], [role="dialog"]',
  modalClose: '[class*="modal-close"], button:has-text("Close")',

  // ── Toasts / Alerts ──
  toast: '[class*="toast"], [role="alert"]',
  successMessage: '[class*="success"]',
  errorMessage: '[class*="error"]',
} as const;
