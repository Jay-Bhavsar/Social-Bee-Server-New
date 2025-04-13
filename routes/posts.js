
// routes/posts.js
const express = require('express');
const { body, query, param } = require('express-validator');
const postController = require('../controllers/postController');
const { authenticateToken } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create a new post with images
router.post(
  '/image',
  uploadMiddleware.postImages,
  uploadMiddleware.handleUploadError,
  [
    body('content').optional().isString().isLength({ max: 2000 }).withMessage('Content must be at most 2000 characters'),
    body('tags').optional().isString().withMessage('Tags must be a JSON string')
  ],
  postController.createPost
);

// Create a new post with video
router.post(
  '/video',
  uploadMiddleware.postVideo,
  uploadMiddleware.handleUploadError,
  [
    body('content').optional().isString().isLength({ max: 2000 }).withMessage('Content must be at most 2000 characters'),
    body('tags').optional().isString().withMessage('Tags must be a JSON string')
  ],
  postController.createPost
);

// Create a text-only post
router.post(
  '/',
  [
    body('content').isString().notEmpty().isLength({ max: 2000 }).withMessage('Content must be at most 2000 characters'),
    body('tags').optional().isString().withMessage('Tags must be a JSON string')
  ],
  postController.createPost
);

// Get a post by ID
router.get(
  '/:postId',
  param('postId').isString().notEmpty().withMessage('Post ID is required'),
  postController.getPost
);

// Get user's posts
router.get(
  '/user/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  postController.getUserPosts
);

// Get timeline posts
router.get(
  '/timeline',
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  postController.getTimelinePosts
);

// Update a post
router.put(
  '/:postId',
  [
    param('postId').isString().notEmpty().withMessage('Post ID is required'),
    body('content').optional().isString().isLength({ max: 2000 }).withMessage('Content must be at most 2000 characters'),
    body('tags').optional().isString().withMessage('Tags must be a JSON string')
  ],
  postController.updatePost
);

// Delete a post
router.delete(
  '/:postId',
  param('postId').isString().notEmpty().withMessage('Post ID is required'),
  postController.deletePost
);

// Like a post
router.post(
  '/:postId/like',
  param('postId').isString().notEmpty().withMessage('Post ID is required'),
  postController.likePost
);

// Unlike a post
router.delete(
  '/:postId/like',
  param('postId').isString().notEmpty().withMessage('Post ID is required'),
  postController.unlikePost
);

// Share a post
router.post(
  '/:postId/share',
  param('postId').isString().notEmpty().withMessage('Post ID is required'),
  postController.sharePost
);

// Search posts
router.get(
  '/search',
  [
    query('query').isString().notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  postController.searchPosts
);

module.exports = router;