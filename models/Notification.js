// models/Notification.js
const { dynamoDb, TABLES } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const Notification = {
  // Create a new notification
  create: async (notificationData) => {
    try {
      const notificationId = notificationData.notificationId || uuidv4();
      const timestamp = new Date().toISOString();
      
      const notificationItem = {
        notificationId,
        recipientId: notificationData.recipientId,
        senderId: notificationData.senderId,
        type: notificationData.type, // like, comment, follow, mention, etc.
        contentId: notificationData.contentId || null,
        contentType: notificationData.contentType || null, // post, comment, user, etc.
        message: notificationData.message,
        read: false,
        timestamp
      };
      
      const params = {
        TableName: 'SocialMedia_Notifications',
        Item: notificationItem,
        ConditionExpression: 'attribute_not_exists(notificationId)'
      };
      
      await dynamoDb.put(params);
      return notificationItem;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },
  
  // Get user's notifications
  getByUserId: async (userId, limit = 20, lastEvaluatedKey = null, unreadOnly = false) => {
    try {
      const params = {
        TableName: 'SocialMedia_Notifications',
        IndexName: 'RecipientIndex',
        KeyConditionExpression: 'recipientId = :recipientId',
        ExpressionAttributeValues: {
          ':recipientId': userId
        },
        ScanIndexForward: false, // Sort in descending order (newest first)
        Limit: limit
      };
      
      // Add filter for unread notifications if requested
      if (unreadOnly) {
        params.FilterExpression = 'read = :read';
        params.ExpressionAttributeValues[':read'] = false;
      }
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamoDb.query(params);
      
      return {
        notifications: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  },
  
  // Mark notification as read
  markAsRead: async (notificationId, userId) => {
    try {
      // Get the notification first to verify ownership
      const getParams = {
        TableName: 'SocialMedia_Notifications',
        Key: { notificationId }
      };
      
      const notification = await dynamoDb.get(getParams);
      
      if (!notification.Item) {
        throw new Error('Notification not found');
      }
      
      if (notification.Item.recipientId !== userId) {
        throw new Error('Not authorized to update this notification');
      }
      
      const updateParams = {
        TableName: 'SocialMedia_Notifications',
        Key: { notificationId },
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read' // 'read' is a reserved keyword
        },
        ExpressionAttributeValues: {
          ':read': true
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(updateParams);
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },
  
  // Mark all notifications as read
  markAllAsRead: async (userId) => {
    try {
      // Get all unread notifications for the user
      const unreadNotifications = await Notification.getByUserId(userId, 100, null, true);
      
      // Update each notification
      const updatePromises = unreadNotifications.notifications.map(notification => {
        const updateParams = {
          TableName: 'SocialMedia_Notifications',
          Key: { notificationId: notification.notificationId },
          UpdateExpression: 'SET #read = :read',
          ExpressionAttributeNames: {
            '#read': 'read'
          },
          ExpressionAttributeValues: {
            ':read': true
          }
        };
        
        return dynamoDb.update(updateParams);
      });
      
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },
  
  // Delete a notification
  delete: async (notificationId, userId) => {
    try {
      // Get the notification first to verify ownership
      const getParams = {
        TableName: 'SocialMedia_Notifications',
        Key: { notificationId }
      };
      
      const notification = await dynamoDb.get(getParams);
      
      if (!notification.Item) {
        throw new Error('Notification not found');
      }
      
      if (notification.Item.recipientId !== userId) {
        throw new Error('Not authorized to delete this notification');
      }
      
      const deleteParams = {
        TableName: 'SocialMedia_Notifications',
        Key: { notificationId }
      };
      
      await dynamoDb.delete(deleteParams);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },
  
  // Get unread notification count
  getUnreadCount: async (userId) => {
    try {
      const params = {
        TableName: 'SocialMedia_Notifications',
        IndexName: 'RecipientIndex',
        KeyConditionExpression: 'recipientId = :recipientId',
        FilterExpression: 'read = :read',
        ExpressionAttributeValues: {
          ':recipientId': userId,
          ':read': false
        },
        Select: 'COUNT'
      };
      
      const result = await dynamoDb.query(params);
      return result.Count;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw error;
    }
  }
};

module.exports = Notification;