const express = require('express');
const { logAccess } = require('../lib/logging');
const { notifiedBodyDirectoryPage } = require('../templates/notified-body-page');

const router = express.Router();

router.get('/', (req, res) => {
  logAccess(req, 'notified_body_directory');
  res.send(notifiedBodyDirectoryPage());
});

module.exports = router;
