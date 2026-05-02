/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const express = require('express');
const { logAccess } = require('../lib/logging');
const { incidentReadinessPage } = require('../templates/incident-readiness-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'incident_readiness_checklist');
  res.send(incidentReadinessPage());
});

module.exports = router;
