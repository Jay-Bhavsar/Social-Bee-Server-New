// controllers/notificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const notificationController = {
  // Get user's notifications
  getNotifications: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { limit = 20, lastKey, unreadOnly } = req.query;
      
      // Parse lastKey if provided
      let lastEvaluatedKey = null;
      if (lastKey) {
        try {
          lastEvaluatedKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        } catch (parseError) {
          return res.status(400).json({ message: 'Invalid lastKey format' });
        }
      }
      
      // Convert unreadOnly to boolean
      const showUnreadOnly = unreadOnly === 'true';
      
      // Get notifications from database
      const result = await Notification.getByUserId(
        userId, 
        parseInt(limit), 
        lastEvaluatedKey,
        showUnreadOnly
      );
      
      // Get sender details for each notification
      const senderIds = [...new Set(result.notifications.map(notification => notification.senderId))];
      
      // Get all users in a single batch
      const userPromises = senderIds.map(id => User.getById(id));
      const users = await Promise.all(userPromises);
      
      // Create a map for fast lookup
      const userMap = {};
      users.forEach(user => {
        if (user) {
          userMap[user.userId] = {
            userId: user.userId,
            username: user.username,
            profilePicture: user.profilePicture
          };
        }
      });
      
      // Format response
      const formattedNotifications = result.notifications.map(notification => ({
        ...notification,
        sender: userMap[notification.senderId] || { userId: notification.senderId, username: 'Unknown' }
      }));
      
      // Encode lastEvaluatedKey for pagination
      let nextKey = null;
      if (result.lastEvaluatedKey) {
        nextKey = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
      }
      
      res.status(200).json({
        notifications: formattedNotifications,
        nextKey
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;
      
      // Mark notification as read
      await Notification.markAsRead(notificationId, userId);
      
      res.status(200).json({
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      
      if (error.message === 'Notification not found' || error.message === 'Not authorized to update this notification') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Mark all notifications as read
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.userId;
      
      // Mark all notifications as read
      await Notification.markAllAsRead(userId);
      
      res.status(200).json({
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Delete a notification
  deleteNotification: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;
      
      // Delete notification
      await Notification.delete(notificationId, userId);
      
      res.status(200).json({
        message: 'Notification deleted'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      
      if (error.message === 'Notification not found' || error.message === 'Not authorized to delete this notification') {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get unread notification count
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.userId;
      
      // Get unread count
      const count = await Notification.getUnreadCount(userId);
      
      res.status(200).json({
        count
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = notificationController;