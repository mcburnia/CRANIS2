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
 * Test data constants — mirrors seed-test-data.ts from the Vitest suite.
 * All users share the same password. IDs are deterministic and never change.
 */

export const TEST_PASSWORD = 'TestPass123!';

export const TEST_USERS = {
  // TestOrg-Manufacturer-Active (billing: active)
  mfgAdmin: 'testadmin@manufacturer-active.test',
  mfgMember1: 'testmember1@manufacturer-active.test',
  mfgMember2: 'testmember2@manufacturer-active.test',
  mfgSuspended: 'testsuspended@manufacturer-active.test',

  // TestOrg-Importer-Trial (billing: trial)
  impAdmin: 'testadmin@importer-trial.test',
  impMember: 'testmember@importer-trial.test',

  // TestOrg-Distributor-Suspended (billing: suspended)
  distAdmin: 'testadmin@distributor-suspended.test',
  distMember: 'testmember@distributor-suspended.test',

  // TestOrg-OSS-ReadOnly (billing: read_only)
  ossAdmin: 'testadmin@oss-readonly.test',
  ossMember: 'testmember@oss-readonly.test',

  // TestOrg-Manufacturer-PastDue (billing: past_due)
  pdAdmin: 'testadmin@manufacturer-pastdue.test',
  pdMember: 'testmember@manufacturer-pastdue.test',

  // TestOrg-Empty (billing: active, no products)
  emptyAdmin: 'testadmin@empty-org.test',

  // Special users
  orphanUser: 'testorphan@noorg.test',
  platformAdmin: 'testplatformadmin@cranis2.test',
} as const;

export const TEST_IDS = {
  orgs: {
    mfgActive:     'a0000001-0000-0000-0000-000000000001',
    impTrial:      'a0000001-0000-0000-0000-000000000002',
    distSuspended: 'a0000001-0000-0000-0000-000000000003',
    ossReadOnly:   'a0000001-0000-0000-0000-000000000004',
    mfgPastDue:    'a0000001-0000-0000-0000-000000000005',
    empty:         'a0000001-0000-0000-0000-000000000006',
  },
  users: {
    mfgAdmin:      'b0000001-0000-0000-0000-000000000001',
    mfgMember1:    'b0000001-0000-0000-0000-000000000002',
    mfgMember2:    'b0000001-0000-0000-0000-000000000003',
    mfgSuspended:  'b0000001-0000-0000-0000-000000000004',
    impAdmin:      'b0000001-0000-0000-0000-000000000005',
    impMember:     'b0000001-0000-0000-0000-000000000006',
    distAdmin:     'b0000001-0000-0000-0000-000000000007',
    distMember:    'b0000001-0000-0000-0000-000000000008',
    ossAdmin:      'b0000001-0000-0000-0000-000000000009',
    ossMember:     'b0000001-0000-0000-0000-00000000000a',
    pdAdmin:       'b0000001-0000-0000-0000-00000000000b',
    pdMember:      'b0000001-0000-0000-0000-00000000000c',
    emptyAdmin:    'b0000001-0000-0000-0000-00000000000d',
    orphanUser:    'b0000001-0000-0000-0000-00000000000e',
    platformAdmin: 'b0000001-0000-0000-0000-00000000000f',
  },
  products: {
    github:       'c0000001-0000-0000-0000-000000000001',
    codeberg:     'c0000001-0000-0000-0000-000000000002',
    gitea:        'c0000001-0000-0000-0000-000000000003',
    forgejo:      'c0000001-0000-0000-0000-000000000004',
    gitlab:       'c0000001-0000-0000-0000-000000000005',
    impGithub:    'c0000001-0000-0000-0000-000000000006',
    impCodeberg:  'c0000001-0000-0000-0000-000000000007',
    distGithub1:  'c0000001-0000-0000-0000-000000000008',
    distGithub2:  'c0000001-0000-0000-0000-000000000009',
    ossGithub:    'c0000001-0000-0000-0000-00000000000a',
    ossGitea:     'c0000001-0000-0000-0000-00000000000b',
    pdGithub:     'c0000001-0000-0000-0000-00000000000c',
    pdForgejo:    'c0000001-0000-0000-0000-00000000000d',
  },
  reports: {
    draft:            'd0000001-0000-0000-0000-000000000001',
    earlyWarningSent: 'd0000001-0000-0000-0000-000000000002',
    notificationSent: 'd0000001-0000-0000-0000-000000000003',
    closed:           'd0000001-0000-0000-0000-000000000004',
  },
} as const;
