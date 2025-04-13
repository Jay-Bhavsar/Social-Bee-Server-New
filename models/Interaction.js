// models/Interaction.js
const { dynamoDb, TABLES } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const Interaction = {
  // Create a new interaction (comment, like, etc.)
  create: async (interactionData) => {
    try {
      const interactionId = interactionData.interactionId || uuidv4();
      const timestamp = new Date().toISOString();
      
      const interactionItem = {
        interactionId,
        type: interactionData.type, // 'comment', 'like', 'share'
        userId: interactionData.userId,
        contentId: interactionData.contentId, // postId, reelId, etc.
        content: interactionData.content || '', // For comments
        parentId: interactionData.parentId || null, // For comment replies
        timestamp
      };
      
      const params = {
        TableName: TABLES.INTERACTIONS,
        Item: interactionItem,
        ConditionExpression: 'attribute_not_exists(interactionId)'
      };
      
      await dynamoDb.put(params);
      
      // If this is a comment, update comment count on the post
      if (interactionData.type === 'comment') {
        await dynamoDb.update({
          TableName: TABLES.POSTS,
          Key: { postId: interactionData.contentId },
          UpdateExpression: 'ADD commentsCount :inc',
          ExpressionAttributeValues: {
            ':inc': 1
          }
        });
      }
      
      return interactionItem;
    } catch (error) {
      console.error('Error creating interaction:', error);
      throw error;
    }
  },
  
  // Get an interaction by ID
  getById: async (interactionId) => {
    try {
      const params = {
        TableName: TABLES.INTERACTIONS,
        Key: { interactionId }
      };
      
      return await dynamoDb.get(params);
    } catch (error) {
      console.error('Error getting interaction by ID:', error);
      throw error;
    }
  },
  
  // Get all interactions for a content item (post, reel, etc.)
  getByContentId: async (contentId, type = null, limit = 50, lastEvaluatedKey = null) => {
    try {
      const params = {
        TableName: TABLES.INTERACTIONS,
        IndexName: 'ContentIndex',
        KeyConditionExpression: 'contentId = :contentId',
        ExpressionAttributeValues: {
          ':contentId': contentId
        },
        Limit: limit
      };
      
      // If type is specified, filter by type
      if (type) {
        params.FilterExpression = 'type = :type';
        params.ExpressionAttributeValues[':type'] = type;
      }
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamoDb.query(params);
      
      return {
        interactions: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting interactions by content ID:', error);
      throw error;
    }
  },
  
  // Get comment replies
  getReplies: async (parentCommentId, limit = 20, lastEvaluatedKey = null) => {
    try {
      const params = {
        TableName: TABLES.INTERACTIONS,
        IndexName: 'ParentIndex',
        KeyConditionExpression: 'parentId = :parentId',
        ExpressionAttributeValues: {
          ':parentId': parentCommentId
        },
        Limit: limit
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamoDb.query(params);
      
      return {
        replies: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting comment replies:', error);
      throw error;
    }
  },
  
  // Delete an interaction
  delete: async (interactionId, userId) => {
    try {
      // First, get the interaction to verify ownership
      const interaction = await Interaction.getById(interactionId);
      
      if (!interaction) {
        throw new Error('Interaction not found');
      }
      
      if (interaction.userId !== userId) {
        throw new Error('Unauthorized to delete this interaction');
      }
      
      const params = {
        TableName: TABLES.INTERACTIONS,
        Key: { interactionId }
      };
      
      await dynamoDb.delete(params);
      
      // If this was a comment, decrement comment count on the post
      if (interaction.type === 'comment') {
        await dynamoDb.update({
          TableName: TABLES.POSTS,
          Key: { postId: interaction.contentId },
          UpdateExpression: 'ADD commentsCount :dec',
          ExpressionAttributeValues: {
            ':dec': -1
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting interaction:', error);
      throw error;
    }
  }
};

module.exports = Interaction;