// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post(
  '/register',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  authController.register
);

// Confirm registration
router.post(
  '/confirm',
  [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('confirmationCode').notEmpty().withMessage('Confirmation code is required')
  ],
  authController.confirmRegistration
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  authController.login
);

// Refresh token
router.post(
  '/refresh-token',
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  authController.refreshToken
);

// Forgot password
router.post(
  '/forgot-password',
  body('email').isEmail().withMessage('Must be a valid email address'),
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('confirmationCode').notEmpty().withMessage('Confirmation code is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  authController.resetPassword
);

// Change password (requires authentication)
router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  authController.changePassword
);

module.exports = router;