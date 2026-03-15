const express = require('express');
const { logAccess } = require('../lib/logging');
const { incidentReadinessPage } = require('../templates/incident-readiness-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'incident_readiness_checklist');
  res.send(incidentReadinessPage());
});

module.exports = router;
