const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');

// Get session bill
router.get('/session/:sessionId', billingController.getSessionBill);

// Process payment
router.post('/payment', verifyToken, checkRole(['admin', 'staff']), billingController.processPayment);

// Get payment history
router.get('/payments', verifyToken, checkRole(['admin', 'staff']), billingController.getPaymentHistory);

// Get user's payment history
router.get('/my-payments', verifyToken, billingController.getUserPayments);

// Get payment by ID
router.get('/payments/:id', verifyToken, billingController.getPaymentById);

// Refund payment (Admin only)
router.post('/payments/:id/refund', verifyToken, checkPermission('manage_billing'), billingController.refundPayment);

// Get billing statistics
router.get('/stats', verifyToken, checkRole(['admin', 'staff']), billingController.getBillingStats);

module.exports = router;
