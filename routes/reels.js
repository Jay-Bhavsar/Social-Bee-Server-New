// routes/reels.js
const express = require('express');
const { body, param, query } = require('express-validator');
const reelController = require('../controllers/reelController');
const { authenticateToken } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create a new reel
router.post(
  '/',
  uploadMiddleware.reelVideo,
  uploadMiddleware.handleUploadError,
  [
    body('caption').optional().isString().isLength({ max: 200 }).withMessage('Caption must be at most 200 characters'),
    body('tags').optional().isString().withMessage('Tags must be a JSON string')
  ],
  reelController.createReel
);

// Get user's reels
router.get(
  '/user/:userId',
  param('userId').isString().notEmpty().withMessage('User ID is required'),
  reelController.getUserReels
);

// Get reel feed
router.get(
  '/feed',
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  reelController.getReelFeed
);

// Like a reel
router.post(
  '/:reelId/like',
  param('reelId').isString().notEmpty().withMessage('Reel ID is required'),
  reelController.likeReel
);

// Unlike a reel
router.delete(
  '/:reelId/like',
  param('reelId').isString().notEmpty().withMessage('Reel ID is required'),
  reelController.unlikeReel
);

// Comment on a reel
router.post(
  '/:reelId/comment',
  [
    param('reelId').isString().notEmpty().withMessage('Reel ID is required'),
    body('content').isString().notEmpty().isLength({ max: 500 }).withMessage('Comment must be at most 500 characters')
  ],
  reelController.commentReel
);

// Delete a reel
router.delete(
  '/:reelId',
  param('reelId').isString().notEmpty().withMessage('Reel ID is required'),
  reelController.deleteReel
);

module.exports = router;