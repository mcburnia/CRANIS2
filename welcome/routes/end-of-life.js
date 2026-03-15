const express = require('express');
const { logAccess } = require('../lib/logging');
const { endOfLifePage } = require('../templates/end-of-life-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'end_of_life_calculator');
  res.send(endOfLifePage());
});

module.exports = router;
