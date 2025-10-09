const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');
const { validateTable, handleValidationErrors } = require('../middleware/validation');

// Get all tables
router.get('/', verifyToken, tableController.getAllTables);

// Get available tables
router.get('/available', verifyToken, tableController.getAvailableTables);

// Get table statistics
router.get('/stats', verifyToken, checkRole(['admin', 'staff']), tableController.getTableStats);

// Get table by ID
router.get('/:id', verifyToken, tableController.getTableById);

// Create new table (Admin only)
router.post('/', verifyToken, checkPermission('manage_tables'), validateTable, handleValidationErrors, tableController.createTable);

// Update table (Admin/Staff)
router.put('/:id', verifyToken, checkRole(['admin', 'staff']), tableController.updateTable);

// Update table status (Staff)
router.patch('/:id/status', verifyToken, checkRole(['admin', 'staff']), tableController.updateTableStatus);

// Delete table (Admin only)
router.delete('/:id', verifyToken, checkPermission('manage_tables'), tableController.deleteTable);

// Delete multiple tables (Admin only)
router.delete('/', verifyToken, checkPermission('manage_tables'), tableController.deleteTable);


// Get table groups
router.get('/groups/all', verifyToken, tableController.getTableGroups);

// Create table group (Admin only)
router.post('/groups', verifyToken, checkPermission('manage_tables'), tableController.createTableGroup);
    router.put('/tablegroups/:id', tableController.updateTableGroup);
    router.delete('/tablegroups/:id',   tableController.deleteTableGroup);

  

module.exports = router;
