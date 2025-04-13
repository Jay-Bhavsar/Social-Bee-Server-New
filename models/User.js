// models/User.js
const { dynamoDb, TABLES } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const User = {
  // Create a new user
  create: async (userData) => {
    try {
      const userId = userData.userId || uuidv4();
      const timestamp = new Date().toISOString();
      
      // Hash password if provided
      let passwordHash = null;
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        passwordHash = await bcrypt.hash(userData.password, salt);
      }
      
      const userItem = {
        userId,
        username: userData.username,
        email: userData.email,
        passwordHash,
        profilePicture: userData.profilePicture || null,
        bio: userData.bio || '',
        following: userData.following || [],
        followers: userData.followers || [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      const params = {
        TableName: TABLES.USERS,
        Item: userItem,
        ConditionExpression: 'attribute_not_exists(userId)'
      };
      
      await dynamoDb.put(params);
      
      // Remove sensitive fields
      delete userItem.passwordHash;
      
      return userItem;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Get user by ID
  getById: async (userId) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        Key: { userId }
      };
      
      const user = await dynamoDb.get(params);
      
      if (user) {
        // Remove sensitive fields
        delete user.passwordHash;
      }
      
      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  },
  
  // Get user by username
  getByUsername: async (username) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        IndexName: 'UsernameIndex',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      };
      
      const users = await dynamoDb.query(params);
      
      if (users && users.length > 0) {
        const user = users[0];
        // Remove sensitive fields
        delete user.passwordHash;
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  },
  
  // Get user by email
  getByEmail: async (email) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      };
      
      const users = await dynamoDb.query(params);
      
      if (users && users.length > 0) {
        return users[0]; // Include passwordHash for authentication
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  },
  
  // Update user profile
  update: async (userId, updates) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Build update expression
      let updateExpression = 'SET updatedAt = :updatedAt';
      const expressionAttributeValues = {
        ':updatedAt': timestamp
      };
      
      // Add fields to update
      const allowedFields = ['username', 'profilePicture', 'bio'];
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          updateExpression += `, ${field} = :${field}`;
          expressionAttributeValues[`:${field}`] = updates[field];
        }
      });
      
      const params = {
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await dynamoDb.update(params);
      
      // Remove sensitive fields
      delete result.Attributes.passwordHash;
      
      return result.Attributes;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },
  
  // Follow user
  followUser: async (userId, targetUserId) => {
    try {
      // Add targetUserId to user's following list
      let params = {
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: 'ADD following :targetUserId',
        ExpressionAttributeValues: {
          ':targetUserId': dynamoDb.createSet([targetUserId])
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(params);
      
      // Add userId to target user's followers list
      params = {
        TableName: TABLES.USERS,
        Key: { userId: targetUserId },
        UpdateExpression: 'ADD followers :userId',
        ExpressionAttributeValues: {
          ':userId': dynamoDb.createSet([userId])
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(params);
      
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  },
  
  // Unfollow user
  unfollowUser: async (userId, targetUserId) => {
    try {
      // Remove targetUserId from user's following list
      let params = {
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: 'DELETE following :targetUserId',
        ExpressionAttributeValues: {
          ':targetUserId': dynamoDb.createSet([targetUserId])
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(params);
      
      // Remove userId from target user's followers list
      params = {
        TableName: TABLES.USERS,
        Key: { userId: targetUserId },
        UpdateExpression: 'DELETE followers :userId',
        ExpressionAttributeValues: {
          ':userId': dynamoDb.createSet([userId])
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(params);
      
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  },
  
  // Get follower list
  getFollowers: async (userId) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        Key: { userId },
        ProjectionExpression: 'followers'
      };
      
      const result = await dynamoDb.get(params);
      
      if (!result || !result.followers) {
        return [];
      }
      
      return Array.from(result.followers);
    } catch (error) {
      console.error('Error getting followers:', error);
      throw error;
    }
  },
  
  // Get following list
  getFollowing: async (userId) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        Key: { userId },
        ProjectionExpression: 'following'
      };
      
      const result = await dynamoDb.get(params);
      
      if (!result || !result.following) {
        return [];
      }
      
      return Array.from(result.following);
    } catch (error) {
      console.error('Error getting following:', error);
      throw error;
    }
  },
  
  // Change password
  changePassword: async (userId, newPassword) => {
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      const params = {
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':passwordHash': passwordHash,
          ':updatedAt': new Date().toISOString()
        }
      };
      
      await dynamoDb.update(params);
      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  },
  
  // Verify password
  verifyPassword: async (userId, password) => {
    try {
      const params = {
        TableName: TABLES.USERS,
        Key: { userId },
        ProjectionExpression: 'passwordHash'
      };
      
      const result = await dynamoDb.get(params);
      
      if (!result || !result.passwordHash) {
        return false;
      }
      
      return bcrypt.compare(password, result.passwordHash);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }
};

module.exports = User;