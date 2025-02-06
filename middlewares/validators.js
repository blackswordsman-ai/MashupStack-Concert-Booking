const { check } = require('express-validator');

const validateEmail = check('email')
  .isEmail()
  .withMessage('Enter a valid email address');

const validatePassword = check('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters long');

module.exports = { validateEmail, validatePassword };
