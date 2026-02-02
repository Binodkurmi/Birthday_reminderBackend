const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Register validation rules
exports.validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters')
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

// Login validation rules
exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Birthday validation rules
exports.validateBirthday = [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  
  body('date')
    .isISO8601()
    .withMessage('Please enter a valid date'),
  
  body('notes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters'),
  
  body('remindBefore')
    .optional()
    .isInt({ min: 0, max: 30 })
    .withMessage('Remind before must be between 0 and 30 days')
];