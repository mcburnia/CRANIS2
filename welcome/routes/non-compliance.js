const express = require('express');
const { logAccess } = require('../lib/logging');
const { nonCompliancePage } = require('../templates/non-compliance-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'non_compliance_guide');
  res.send(nonCompliancePage());
});

module.exports = router;
