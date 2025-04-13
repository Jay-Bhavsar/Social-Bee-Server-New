// routes/interactions.js
const express = require('express');
const { body, param, query } = require('express-validator');
const interactionController = require('../controllers/interactionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Add a comment
router.post(
  '/comment',
  [
    body('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('content').isString().notEmpty().isLength({ max: 500 }).withMessage('Comment must be at most 500 characters'),
    body('parentId').optional().isString().withMessage('Parent ID must be a string')
  ],
  interactionController.addComment
);

// Get comments for a content item
router.get(
  '/comments/:contentId',
  [
    param('contentId').isString().notEmpty().withMessage('Content ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  interactionController.getComments
);

// Get comment replies
router.get(
  '/replies/:commentId',
  [
    param('commentId').isString().notEmpty().withMessage('Comment ID is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  interactionController.getReplies
);

// Delete a comment
router.delete(
  '/comment/:commentId',
  param('commentId').isString().notEmpty().withMessage('Comment ID is required'),
  interactionController.deleteComment
);

// Like a comment
router.post(
  '/comment/:commentId/like',
  param('commentId').isString().notEmpty().withMessage('Comment ID is required'),
  interactionController.likeComment
);

// Unlike a comment
router.delete(
  '/comment/:commentId/like',
  param('commentId').isString().notEmpty().withMessage('Comment ID is required'),
  interactionController.unlikeComment
);

module.exports = router;