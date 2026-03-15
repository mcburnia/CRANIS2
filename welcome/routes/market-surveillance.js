const express = require('express');
const { logAccess } = require('../lib/logging');
const { marketSurveillancePage } = require('../templates/market-surveillance-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'market_surveillance_registration');
  res.send(marketSurveillancePage());
});

module.exports = router;
