// routes/notifications.js
const express = require('express');
const { query, param } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get user's notifications
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be a boolean')
  ],
  notificationController.getNotifications
);

// Mark notification as read
router.put(
  '/:notificationId/read',
  param('notificationId').isString().notEmpty().withMessage('Notification ID is required'),
  notificationController.markAsRead
);

// Mark all notifications as read
router.put(
  '/read-all',
  notificationController.markAllAsRead
);

// Delete a notification
router.delete(
  '/:notificationId',
  param('notificationId').isString().notEmpty().withMessage('Notification ID is required'),
  notificationController.deleteNotification
);

// Get unread notification count
router.get(
  '/unread-count',
  notificationController.getUnreadCount
);

module.exports = router;