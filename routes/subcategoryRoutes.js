const express = require('express');
const router = express.Router();
const subcategoryController = require('../controllers/subcategoryController');

router.get('/', subcategoryController.getByCategory);
router.post('/', subcategoryController.create);
router.put('/:id', subcategoryController.update);
router.delete('/:id', subcategoryController.delete);
router.get('/getallsubCategorys', subcategoryController.getallsubCategory);




module.exports = router;
