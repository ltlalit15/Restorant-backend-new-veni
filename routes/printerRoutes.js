const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');

// Get all printers
router.get('/', verifyToken, checkRole(['admin', 'staff']), printerController.getAllPrinters);

// Get printer by ID
router.get('/:id', verifyToken, checkRole(['admin', 'staff']), printerController.getPrinterById);

// Create new printer (Admin only)
router.post('/', verifyToken, checkPermission('manage_printers'), printerController.createPrinter);

// Update printer (Admin only)
router.put('/:id', verifyToken, checkPermission('manage_printers'), printerController.updatePrinter);

// Test printer
router.post('/:id/test', verifyToken, checkRole(['admin', 'staff']), printerController.testPrinter);

// Print order
router.post('/print-order', verifyToken, checkRole(['admin', 'staff']), printerController.printOrder);

// Print receipt
router.post('/print-receipt', verifyToken, checkRole(['admin', 'staff']), printerController.printReceipt);

// Update printer status
router.patch('/:id/status', verifyToken, checkRole(['admin', 'staff']), printerController.updatePrinterStatus);

// Delete printer (Admin only)
router.delete('/:id', verifyToken, checkPermission('manage_printers'), printerController.deletePrinter);

// Test Print
router.post('/testPrint', verifyToken, checkRole(['admin', 'staff']), printerController.testPrint);


module.exports = router;
