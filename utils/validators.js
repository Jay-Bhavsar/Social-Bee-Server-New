// utils/validators.js
const { body, param, query } = require('express-validator');

// Reusable validation patterns
const patterns = {
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/,
  objectId: /^[0-9a-fA-F]{24}$/,
  username: /^[a-zA-Z0-9_\.]{3,30}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
};

// Validation error messages
const messages = {
  required: 'This field is required',
  email: 'Please provide a valid email address',
  password: 'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number',
  username: 'Username must be 3-30 characters and can only contain letters, numbers, underscores, and periods',
  minLength: (field, length) => `${field} must be at least ${length} characters`,
  maxLength: (field, length) => `${field} must be at most ${length} characters`,
  invalidId: 'Invalid ID format'
};

// Auth validators
const authValidators = {
  register: [
    body('username')
      .notEmpty().withMessage(messages.required)
      .isLength({ min: 3, max: 30 }).withMessage(messages.username)
      .matches(patterns.username).withMessage(messages.username),
    body('email')
      .notEmpty().withMessage(messages.required)
      .isEmail().withMessage(messages.email)
      .matches(patterns.email).withMessage(messages.email),
    body('password')
      .notEmpty().withMessage(messages.required)
      .isLength({ min: 8 }).withMessage(messages.minLength('Password', 8))
      .matches(patterns.password).withMessage(messages.password)
  ],
  
  login: [
    body('email')
      .notEmpty().withMessage(messages.required)
      .isEmail().withMessage(messages.email),
    body('password')
      .notEmpty().withMessage(messages.required)
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage(messages.required),
    body('newPassword')
      .notEmpty().withMessage(messages.required)
      .isLength({ min: 8 }).withMessage(messages.minLength('Password', 8))
      .matches(patterns.password).withMessage(messages.password)
  ],
  
  resetPassword: [
    body('email')
      .notEmpty().withMessage(messages.required)
      .isEmail().withMessage(messages.email),
    body('confirmationCode')
      .notEmpty().withMessage('Confirmation code is required'),
    body('newPassword')
      .notEmpty().withMessage(messages.required)
      .isLength({ min: 8 }).withMessage(messages.minLength('Password', 8))
      .matches(patterns.password).withMessage(messages.password)
  ]
};

// User validators
const userValidators = {
  updateProfile: [
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 }).withMessage(messages.username)
      .matches(patterns.username).withMessage(messages.username),
    body('bio')
      .optional()
      .isLength({ max: 200 }).withMessage(messages.maxLength('Bio', 200))
  ],
  
  getUserById: [
    param('userId')
      .notEmpty().withMessage('User ID is required')
  ],
  
  followUser: [
    param('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
  ],
  
  searchUsers: [
    query('query')
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 1 }).withMessage('Search query must not be empty'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ]
};

// Post validators
const postValidators = {
  createPost: [
    body('content')
      .optional()
      .isString().withMessage('Content must be a string')
      .isLength({ max: 2000 }).withMessage(messages.maxLength('Content', 2000)),
    body('tags')
      .optional()
      .isString().withMessage('Tags must be a JSON string')
  ],
  
  getPost: [
    param('postId')
      .notEmpty().withMessage('Post ID is required')
  ],
  
  getUserPosts: [
    param('userId')
      .notEmpty().withMessage('User ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  
  timelinePosts: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  
  updatePost: [
    param('postId')
      .notEmpty().withMessage('Post ID is required'),
    body('content')
      .optional()
      .isString().withMessage('Content must be a string')
      .isLength({ max: 2000 }).withMessage(messages.maxLength('Content', 2000)),
    body('tags')
      .optional()
      .isString().withMessage('Tags must be a JSON string')
  ],
  
  searchPosts: [
    query('query')
      .notEmpty().withMessage('Search query is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]
};

// Story validators
const storyValidators = {
  createStory: [
    body('caption')
      .optional()
      .isString().withMessage('Caption must be a string')
      .isLength({ max: 200 }).withMessage(messages.maxLength('Caption', 200))
  ],
  
  getUserStories: [
    param('userId')
      .notEmpty().withMessage('User ID is required')
  ],
  
  viewStory: [
    param('storyId')
      .notEmpty().withMessage('Story ID is required')
  ]
};

// Reel validators
const reelValidators = {
  createReel: [
    body('caption')
      .optional()
      .isString().withMessage('Caption must be a string')
      .isLength({ max: 200 }).withMessage(messages.maxLength('Caption', 200)),
    body('tags')
      .optional()
      .isString().withMessage('Tags must be a JSON string')
  ],
  
  getUserReels: [
    param('userId')
      .notEmpty().withMessage('User ID is required')
  ],
  
  reelFeed: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ]
};

// Interaction validators
const interactionValidators = {
  addComment: [
    body('contentId')
      .notEmpty().withMessage('Content ID is required'),
    body('content')
      .notEmpty().withMessage('Comment content is required')
      .isString().withMessage('Comment content must be a string')
      .isLength({ max: 500 }).withMessage(messages.maxLength('Comment', 500)),
    body('parentId')
      .optional()
      .isString().withMessage('Parent ID must be a string')
  ],
  
  getComments: [
    param('contentId')
      .notEmpty().withMessage('Content ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  
  getReplies: [
    param('commentId')
      .notEmpty().withMessage('Comment ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  
  likeContent: [
    param('contentId')
      .notEmpty().withMessage('Content ID is required')
  ]
};

// Notification validators
const notificationValidators = {
  getNotifications: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('unreadOnly')
      .optional()
      .isBoolean().withMessage('unreadOnly must be a boolean')
  ],
  
  markAsRead: [
    param('notificationId')
      .notEmpty().withMessage('Notification ID is required')
  ]
};

// Utility function to validate array of UUIDs
const validateUUIDs = (value, { req }) => {
  if (!value) return true;
  
  // Check if it's a valid JSON string
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Not an array');
    }
    
    // Check if each item is a valid UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const id of parsed) {
      if (typeof id !== 'string' || !uuidPattern.test(id)) {
        throw new Error('Invalid UUID');
      }
    }
    
    return true;
  } catch (error) {
    throw new Error('Invalid UUID array');
  }
};

// Common validators for pagination and filtering
const commonValidators = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  
  sorting: [
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'likes', 'comments']).withMessage('Invalid sort field'),
    query('order')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
  ],
  
  idParam: [
    param('id')
      .notEmpty().withMessage('ID is required')
  ],
  
  uuidArray: body('ids').custom(validateUUIDs)
};

module.exports = {
  patterns,
  messages,
  authValidators,
  userValidators,
  postValidators,
  storyValidators,
  reelValidators,
  interactionValidators,
  notificationValidators,
  commonValidators,
  validateUUIDs
};