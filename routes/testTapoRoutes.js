const express = require('express');
const router = express.Router();
const { testDummyTapoPlug } = require('../controllers/testTapoController');


// ✅ Dummy plug test route
router.get("/test-dummy-tapo", testDummyTapoPlug);

module.exports = router;


