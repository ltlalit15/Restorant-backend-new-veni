const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');
const { validateMenuItem, handleValidationErrors } = require('../middleware/validation');

// Get all menu categories
router.get('/category', menuController.getAllCategories);



router.post('/category', menuController.createCategory);

router.post('/category', menuController.createCategory);
// Subcategory


router.get('/category', menuController.getAllCategoriesNew);
router.post('/category', menuController.createCategoryNew);
router.put('/category/:id', menuController.updateCategoryNew);
router.delete('/category/:id', menuController.deleteCategoryNew);


// ===== Subcategories =====
router.get('/subcategories', menuController.getAllSubcategories);
router.post('/subcategory', menuController.createSubcategory);
router.put('/subcategory/:id', menuController.updateSubcategory);
router.delete('/subcategory/:id', menuController.deleteSubcategory);

// ===== Items =====
router.get('/items', menuController.getAllMenuItemsnew);
router.post('/items', menuController.createItems);
router.put('/items/:id', menuController.updateItem);
router.delete('/items/:id', menuController.deleteItem);



// Get menu items by category
router.get('/categories/:categoryId/items', menuController.getItemsByCategory);

// Get menu item by ID
router.get('/items/:id', menuController.getMenuItemById);

// Create new category (Admin only)
router.post('/categories', verifyToken, checkPermission('manage_menu'), menuController.createCategory);

// Create new menu item (Admin only)
router.post('/items', verifyToken, checkPermission('manage_menu'), validateMenuItem, handleValidationErrors, menuController.createMenuItem);

// Update category (Admin only)
router.put('/categories/:id', verifyToken, checkPermission('manage_menu'), menuController.updateCategory);

// Update menu item (Admin only)
router.put('/items/:id', verifyToken, checkPermission('manage_menu'), menuController.updateMenuItem);

// Delete category (Admin only)
router.delete('/categories/:id', verifyToken, checkPermission('manage_menu'), menuController.deleteCategory);

// Delete menu item (Admin only)
router.delete('/items/:id', verifyToken, checkPermission('manage_menu'), menuController.deleteMenuItem);

module.exports = router;
