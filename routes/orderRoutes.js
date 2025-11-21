const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');
const { validateOrder, handleValidationErrors } = require('../middleware/validation');

// Get all orders
router.get('/', verifyToken, checkRole(['admin', 'staff']), orderController.getAllOrders);

// Get pending orders (KOT)
router.get('/pending', verifyToken, checkRole(['admin', 'staff']), orderController.getPendingOrders);

router.get('/ready', verifyToken, checkRole(['admin', 'staff']), orderController.getReadyOrders);

// Get order statistics
router.get('/stats', verifyToken, checkRole(['admin', 'staff']), orderController.getOrderStats);

// Get order by ID
router.get('/:id', verifyToken, orderController.getOrderById);

// Create new order
router.post('/', verifyToken, checkPermission('manage_orders'), orderController.createOrder);

// Update order status
router.patch('/:id/status', verifyToken, checkRole(['admin', 'staff']), orderController.updateOrderStatus);

// Update order item status
router.patch('/items/:itemId/status', verifyToken, checkRole(['admin', 'staff']), orderController.updateOrderItemStatus);

// Get orders by table
router.get('/table/:tableId',  orderController.getOrdersByTable);

// Get orders by session
router.get('/session/:sessionId', orderController.getOrdersBySession);

// Delete order (Admin only)
router.delete('/:id', verifyToken, checkPermission('manage_orders'), orderController.deleteOrder);

module.exports = router;
