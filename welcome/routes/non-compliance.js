/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

const express = require('express');
const { logAccess } = require('../lib/logging');
const { nonCompliancePage } = require('../templates/non-compliance-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'non_compliance_guide');
  res.send(nonCompliancePage());
});

module.exports = router;
