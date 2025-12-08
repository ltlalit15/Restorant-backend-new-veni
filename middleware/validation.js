const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUser = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  // body('password')
  //   .isLength({ min: 6 })
  //   .withMessage('Password must be at least 6 characters long'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('role')
    .optional()
    .isIn(['admin', 'staff', 'user'])
    .withMessage('Role must be admin, staff, or user')
];

// Login validation rules
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Table validation rules
// Table validation rules
const validateTable = [
  body('table_type')
    .isIn(['pool', 'snooker', 'playstation', 'dining', 'largetable'])
    .withMessage('Invalid table type'),
  
  body('hourly_rate')
    .optional({ checkFalsy: true }) // allow "" or null
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),
  
  body('capacity')
    .optional({ checkFalsy: true }) // allow "" or null
    .isInt({ min: 1 })
    .withMessage('Capacity must be a positive integer')
];


// Order validation rules
const validateOrder = [
  body('table_id')
    .isInt({ min: 1 })
    .withMessage('Valid table ID is required'),
  body('customer_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  body('order_type')
    .optional()
    .isIn(['dine_in', 'takeaway'])
    .withMessage('Order type must be dine_in or takeaway'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.menu_item_id')
    .isInt({ min: 1 })
    .withMessage('Valid menu item ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer')
];

// Menu item validation rules
const validateMenuItem = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

// Reservation validation rules
const validateReservation = [
  body('table_id')
    .isInt({ min: 1 })
    .withMessage('Valid table ID is required'),
  body('customer_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  body('customer_phone')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('reservation_date')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('reservation_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Please provide a valid time in HH:MM format'),
  body('party_size')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Party size must be between 1 and 20')
];

// Session validation rules
const validateSession = [
  body('table_id')
    .isInt({ min: 1 })
    .withMessage('Valid table ID is required')

];

module.exports = {
  handleValidationErrors,
  validateUser,
  validateLogin,
  validateTable,
  validateOrder,
  validateMenuItem,
  validateReservation,
  validateSession
};
