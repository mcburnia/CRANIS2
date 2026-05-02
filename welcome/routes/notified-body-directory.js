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
const { notifiedBodyDirectoryPage } = require('../templates/notified-body-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'notified_body_directory');
  res.send(notifiedBodyDirectoryPage());
});

module.exports = router;
