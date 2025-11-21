const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validateUser, validateLogin, handleValidationErrors } = require('../middleware/validation');

// Public routes
router.post('/register', validateUser, handleValidationErrors, authController.register);
router.post('/login', validateLogin, handleValidationErrors, authController.login);

// Protected routes
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile/:id', authController.updateProfile);
router.put('/change-password/:id', authController.changePassword);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
