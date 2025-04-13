// models/Story.js
const { dynamoDb, TABLES } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const Story = {
  // Create a new story
  create: async (storyData) => {
    try {
      const contentId = storyData.contentId || uuidv4();
      const timestamp = new Date().toISOString();
      
      // Calculate expiry time (24 hours from now)
      const expiryTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours in seconds
      
      const storyItem = {
        contentId,
        contentType: storyData.contentType || 'story',
        userId: storyData.userId,
        mediaUrl: storyData.mediaUrl,
        mediaType: storyData.mediaType || 'image', // image or video
        caption: storyData.caption || '',
        viewers: [],
        timestamp,
        expiryTime // TTL attribute for auto-deletion (only for stories)
      };
      
      const params = {
        TableName: TABLES.STORIES,
        Item: storyItem,
        ConditionExpression: 'attribute_not_exists(contentId)'
      };
      
      await dynamoDb.put(params);
      return storyItem;
    } catch (error) {
      console.error('Error creating story:', error);
      throw error;
    }
  },
  
  // Get a story by ID
  getById: async (contentId) => {
    try {
      const params = {
        TableName: TABLES.STORIES,
        Key: { contentId }
      };
      
      return await dynamoDb.get(params);
    } catch (error) {
      console.error('Error getting story by ID:', error);
      throw error;
    }
  },
  
  // Get user's stories
  getByUserId: async (userId) => {
    try {
      const params = {
        TableName: TABLES.STORIES,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentType': 'story'
        }
      };
      
      const result = await dynamoDb.query(params);
      return result.Items;
    } catch (error) {
      console.error('Error getting user stories:', error);
      throw error;
    }
  },
  
  // Get user's reels (similar to stories but with contentType='reel')
  getReelsByUserId: async (userId) => {
    try {
      const params = {
        TableName: TABLES.STORIES,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentType': 'reel'
        }
      };
      
      const result = await dynamoDb.query(params);
      return result.Items;
    } catch (error) {
      console.error('Error getting user reels:', error);
      throw error;
    }
  },
  
  // Get stories from multiple users (for stories feed)
  getStoriesFeed: async (userIds) => {
    try {
      // Use batch queries for multiple users
      const queries = userIds.map(userId => ({
        TableName: TABLES.STORIES,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentType': 'story'
        }
      }));
      
      // Execute queries in parallel
      const results = await Promise.all(queries.map(params => dynamoDb.query(params)));
      
      // Combine results by user
      const storiesByUser = {};
      
      results.forEach((result, index) => {
        const userId = userIds[index];
        if (result.Items && result.Items.length > 0) {
          storiesByUser[userId] = result.Items;
        }
      });
      
      return storiesByUser;
    } catch (error) {
      console.error('Error getting stories feed:', error);
      throw error;
    }
  },
  
  // Get reels feed (popular and followed users)
  getReelsFeed: async (userIds, limit = 20) => {
    try {
      // First, get reels from followed users
      const followedQueries = userIds.map(userId => ({
        TableName: TABLES.STORIES,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentType': 'reel'
        },
        Limit: Math.floor(limit / 2) // Half from followed users
      }));
      
      // Execute queries in parallel
      const followedResults = await Promise.all(followedQueries.map(params => dynamoDb.query(params)));
      const followedReels = followedResults.flatMap(result => result.Items);
      
      // Then, get popular reels (in a real app, this would use metrics like views or likes)
      // This is a simplified approach - would need a more sophisticated ranking system
      const popularParams = {
        TableName: TABLES.STORIES,
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':contentType': 'reel'
        },
        Limit: limit - followedReels.length // Remaining slots for popular reels
      };
      
      const popularResult = await dynamoDb.scan(popularParams);
      const popularReels = popularResult.Items.filter(
        reel => !followedReels.some(f => f.contentId === reel.contentId)
      );
      
      // Combine and shuffle results for variety
      const allReels = [...followedReels, ...popularReels];
      
      // Fisher-Yates shuffle algorithm
      for (let i = allReels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allReels[i], allReels[j]] = [allReels[j], allReels[i]];
      }
      
      return allReels.slice(0, limit);
    } catch (error) {
      console.error('Error getting reels feed:', error);
      throw error;
    }
  },
  
  // Mark a story as viewed by a user
  markAsViewed: async (contentId, viewerId) => {
    try {
      const params = {
        TableName: TABLES.STORIES,
        Key: { contentId },
        UpdateExpression: 'ADD viewers :viewerId',
        ExpressionAttributeValues: {
          ':viewerId': dynamoDb.createSet([viewerId])
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      await dynamoDb.update(params);
      return true;
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      throw error;
    }
  },
  
  // Delete a story or reel
  delete: async (contentId, userId) => {
    try {
      // First, verify ownership
      const story = await Story.getById(contentId);
      
      if (!story) {
        throw new Error('Content not found');
      }
      
      if (story.userId !== userId) {
        throw new Error('Unauthorized to delete this content');
      }
      
      const params = {
        TableName: TABLES.STORIES,
        Key: { contentId }
      };
      
      await dynamoDb.delete(params);
      return true;
    } catch (error) {
      console.error('Error deleting content:', error);
      throw error;
    }
  },
  
  // Increment view count for a reel
  incrementViews: async (contentId) => {
    try {
      const params = {
        TableName: TABLES.STORIES,
        Key: { contentId },
        UpdateExpression: 'ADD viewCount :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      const result = await dynamoDb.update(params);
      return result.Attributes.viewCount;
    } catch (error) {
      console.error('Error incrementing view count:', error);
      throw error;
    }
  }
};

module.exports = Story;