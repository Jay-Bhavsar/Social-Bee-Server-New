// routes/users.js
const express = require('express');
const { body, param, query } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

const router = express.Router();

// Public routes (no authentication required)
// Get user profile
router.get(
  '/:userId',
  param('userId').isString().notEmpty().withMessage('User ID is required'),
  userController.getProfile
);

// Search users
router.get(
  '/search',
  [
    query('query').isString().notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  userController.searchUsers
);

// Get user followers
router.get(
  '/:userId/followers',
  param('userId').isString().notEmpty().withMessage('User ID is required'),
  userController.getFollowers
);

// Get user following
router.get(
  '/:userId/following',
  param('userId').isString().notEmpty().withMessage('User ID is required'),
  userController.getFollowing
);

// Protected routes (authentication required)
router.use(authenticateToken);

// Update user profile
router.put(
  '/profile',
  [
    body('username').optional().isString().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
    body('bio').optional().isString().isLength({ max: 200 }).withMessage('Bio must be at most 200 characters')
  ],
  userController.updateProfile
);

// Update profile picture
router.put(
  '/profile-picture',
  uploadMiddleware.profilePicture,
  uploadMiddleware.handleUploadError,
  userController.updateProfilePicture
);

// Follow a user
router.post(
  '/follow/:targetUserId',
  param('targetUserId').isString().notEmpty().withMessage('Target user ID is required'),
  userController.followUser
);

// Unfollow a user
router.delete(
  '/follow/:targetUserId',
  param('targetUserId').isString().notEmpty().withMessage('Target user ID is required'),
  userController.unfollowUser
);

// Get suggested users to follow
router.get(
  '/suggested',
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  userController.getSuggestedUsers
);

module.exports = router;