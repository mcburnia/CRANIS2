const express = require('express');
const { logAccess } = require('../lib/logging');
const { supplyChainRiskPage } = require('../templates/supply-chain-risk-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'supply_chain_risk_assessment');
  res.send(supplyChainRiskPage());
});

module.exports = router;
