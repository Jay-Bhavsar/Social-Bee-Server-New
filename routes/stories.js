// routes/stories.js
const express = require('express');
const { body, param } = require('express-validator');
const storyController = require('../controllers/storyController');
const { authenticateToken } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create a new story with image
router.post(
  '/image',
  uploadMiddleware.storyImage,
  uploadMiddleware.handleUploadError,
  [
    body('caption').optional().isString().isLength({ max: 200 }).withMessage('Caption must be at most 200 characters')
  ],
  storyController.createStory
);

// Create a new story with video
router.post(
  '/video',
  uploadMiddleware.storyVideo,
  uploadMiddleware.handleUploadError,
  [
    body('caption').optional().isString().isLength({ max: 200 }).withMessage('Caption must be at most 200 characters')
  ],
  storyController.createStory
);

// Get user's stories
router.get(
  '/user/:userId',
  param('userId').isString().notEmpty().withMessage('User ID is required'),
  storyController.getUserStories
);

// Get stories feed
router.get(
  '/feed',
  storyController.getStoriesFeed
);

// Mark a story as viewed
router.post(
  '/:storyId/view',
  param('storyId').isString().notEmpty().withMessage('Story ID is required'),
  storyController.viewStory
);

// Delete a story
router.delete(
  '/:storyId',
  param('storyId').isString().notEmpty().withMessage('Story ID is required'),
  storyController.deleteStory
);

module.exports = router;