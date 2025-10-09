const express = require('express');
const router = express.Router();
const { getReports, getTableOrdersByDate  } = require('../controllers/reportsController');

// GET /api/reports?reportBy=Daily&reportType=Table Revenue Report
router.get('/', getReports);

router.get('/table-orders', getTableOrdersByDate);


module.exports = router;
