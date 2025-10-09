const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Get dashboard overview
router.get('/dashboard', verifyToken, checkRole(['admin', 'staff']), reportController.getDashboardOverview);

// Get revenue reports
router.get('/revenue', verifyToken, checkRole(['admin', 'staff']), reportController.getRevenueReport);

// Get table utilization report
router.get('/table-utilization', verifyToken, checkRole(['admin', 'staff']), reportController.getTableUtilizationReport);

// Get menu performance report
router.get('/menu-performance', verifyToken, checkRole(['admin', 'staff']), reportController.getMenuPerformanceReport);

// Get customer analytics
router.get('/customer-analytics', verifyToken, checkRole(['admin', 'staff']), reportController.getCustomerAnalytics);

// Get hourly performance
router.get('/hourly-performance', verifyToken, checkRole(['admin', 'staff']), reportController.getHourlyPerformance);

// Export report data
router.get('/export/:reportType', verifyToken, checkRole(['admin', 'staff']), reportController.exportReport);




module.exports = router;
