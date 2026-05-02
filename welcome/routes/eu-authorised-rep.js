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
const { euAuthorisedRepPage } = require('../templates/eu-authorised-rep-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'eu_authorised_representative');
  res.send(euAuthorisedRepPage());
});

module.exports = router;
