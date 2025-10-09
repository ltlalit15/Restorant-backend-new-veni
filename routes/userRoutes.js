const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');
const { validateUser, handleValidationErrors } = require('../middleware/validation');

// Get all users (Admin only)
router.get('/', verifyToken, userController.getAllUsers);

// Get user by ID (Admin/Staff)
router.get('/:id', verifyToken, checkRole(['admin', 'staff']), userController.getUserById);

// Create new user (Admin only)
router.post('/', verifyToken, checkPermission('manage_users'), validateUser, handleValidationErrors, userController.createUser);

// Update user (Admin only)
router.put('/:id', verifyToken, checkPermission('manage_users'), userController.updateUser);

// Delete user (Admin only)
router.delete('/:id', verifyToken, checkPermission('manage_users'), userController.deleteUser);

// Get user statistics (Admin only)
router.get('/stats/overview', verifyToken, checkRole(['admin']), userController.getUserStats);

// Forget Password
router.post('/forget-password', userController.forgetPassword);

// Reset Password
router.post('/reset-password', userController.resetPassword);

module.exports = router;
