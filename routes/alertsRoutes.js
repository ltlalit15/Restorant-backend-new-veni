
const express = require('express');
const router = express.Router();
const { getAllAlerts } = require('../controllers/alertsController');

// GET /api/reports?reportBy=Daily&reportType=Table Revenue Report
router.get('/', getAllAlerts);

module.exports = router;
