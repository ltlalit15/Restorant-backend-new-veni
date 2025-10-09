const express = require('express');
const router = express.Router();
const businessSettingsController = require('../controllers/businessSettingsController');

// Get Settings
router.get('/', businessSettingsController.getSettings);

// Update Settings
router.put('/', businessSettingsController.updateSettings);

module.exports = router;
