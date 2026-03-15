const express = require('express');
const { logAccess } = require('../lib/logging');
const { euAuthorisedRepPage } = require('../templates/eu-authorised-rep-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'eu_authorised_representative');
  res.send(euAuthorisedRepPage());
});

module.exports = router;
