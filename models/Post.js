// models/Post.js
const { dynamoDb, TABLES } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const Post = {
  // Create a new post
  create: async (postData) => {
    try {
      const postId = postData.postId || uuidv4();
      const timestamp = new Date().toISOString();
      
      const postItem = {
        postId,
        userId: postData.userId,
        content: postData.content || '',
        mediaUrls: postData.mediaUrls || [],
        mediaType: postData.mediaType || 'none', // none, image, video
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        tags: postData.tags || [],
        timestamp,
      };
      
      const params = {
        TableName: TABLES.POSTS,
        Item: postItem,
        ConditionExpression: 'attribute_not_exists(postId)'
      };
      
      await dynamoDb.put(params);
      return postItem;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },
  
  // Get post by ID
  getById: async (postId) => {
    try {
      const params = {
        TableName: TABLES.POSTS,
        Key: { postId }
      };
      
      return await dynamoDb.get(params);
    } catch (error) {
      console.error('Error getting post by ID:', error);
      throw error;
    }
  },
  
  // Get user's posts
  getByUserId: async (userId, limit = 20, lastEvaluatedKey = null) => {
    try {
      const params = {
        TableName: TABLES.POSTS,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Sort in descending order (newest first)
        Limit: limit
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamoDb.query(params);
      
      return {
        posts: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting user posts:', error);
      throw error;
    }
  },
  
  // Get timeline posts (posts from followed users)
  getTimelinePosts: async (userIds, limit = 20, lastEvaluatedKey = null) => {
    try {
      // Use a batch query approach for timeline
      const queries = userIds.map(userId => ({
        TableName: TABLES.POSTS,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: limit
      }));
      
      // Execute queries in parallel
      const results = await Promise.all(queries.map(params => dynamoDb.query(params)));
      
      // Combine and sort all posts
      const allPosts = results.flatMap(result => result.Items);
      
      // Sort by timestamp (newest first)
      const sortedPosts = allPosts.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Apply limit
      return sortedPosts.slice(0, limit);
    } catch (error) {
      console.error('Error getting timeline posts:', error);
      throw error;
    }
  },
  
  // Update post
  update: async (postId, userId, updates) => {
    try {
      // Build update expression
      let updateExpression = 'SET updatedAt = :updatedAt';
      const expressionAttributeValues = {
        ':updatedAt': new Date().toISOString(),
        ':userId': userId // For condition check
      };
      
      // Add fields to update
      const allowedFields = ['content', 'mediaUrls', 'mediaType', 'tags'];
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          updateExpression += `, ${field} = :${field}`;
          expressionAttributeValues[`:${field}`] = updates[field];
        }
      });
      
      const params = {
        TableName: TABLES.POSTS,
        Key: { postId },
        UpdateExpression: updateExpression,
        ConditionExpression: 'userId = :userId', // Ensure user owns the post
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await dynamoDb.update(params);
      return result.Attributes;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },
  
  // Delete post
  delete: async (postId, userId) => {
    try {
      // First, confirm user owns the post
      const post = await Post.getById(postId);
      
      if (!post || post.userId !== userId) {
        throw new Error('Unauthorized to delete this post');
      }
      
      const params = {
        TableName: TABLES.POSTS,
        Key: { postId }
      };
      
      await dynamoDb.delete(params);
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },
  
  // Like a post
  like: async (postId, userId) => {
    try {
      // Create interaction record
      const interactionId = uuidv4();
      const timestamp = new Date().toISOString();
      
      const interactionItem = {
        interactionId,
        type: 'like',
        userId,
        contentId: postId,
        timestamp
      };
      
      // Update post's like count atomically
      const postParams = {
        TableName: TABLES.POSTS,
        Key: { postId },
        UpdateExpression: 'ADD likesCount :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      // Write interaction record
      const interactionParams = {
        TableName: TABLES.INTERACTIONS,
        Item: interactionItem
      };
      
      // Use transaction to ensure both operations succeed or fail together
      const transactionParams = {
        TransactItems: [
          { Update: postParams },
          { Put: interactionParams }
        ]
      };
      
      await dynamoDb.transactWrite(transactionParams);
      
      return { 
        success: true, 
        likesCount: (await Post.getById(postId)).likesCount 
      };
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  },
  
  // Unlike a post
  unlike: async (postId, userId) => {
    try {
      // Find existing like interaction
      const params = {
        TableName: TABLES.INTERACTIONS,
        IndexName: 'UserContentIndex',
        KeyConditionExpression: 'userId = :userId AND contentId = :contentId',
        FilterExpression: 'type = :type',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentId': postId,
          ':type': 'like'
        }
      };
      
      const interactions = await dynamoDb.query(params);
      
      if (!interactions || interactions.length === 0) {
        return { success: false, message: 'Like not found' };
      }
      
      const interactionId = interactions[0].interactionId;
      
      // Update post's like count atomically
      const postParams = {
        TableName: TABLES.POSTS,
        Key: { postId },
        UpdateExpression: 'ADD likesCount :dec',
        ExpressionAttributeValues: {
          ':dec': -1
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      // Delete interaction record
      const interactionParams = {
        TableName: TABLES.INTERACTIONS,
        Key: { interactionId }
      };
      
      // Use transaction to ensure both operations succeed or fail together
      const transactionParams = {
        TransactItems: [
          { Update: postParams },
          { Delete: interactionParams }
        ]
      };
      
      await dynamoDb.transactWrite(transactionParams);
      
      return { 
        success: true, 
        likesCount: (await Post.getById(postId)).likesCount 
      };
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  },
  
  // Share a post
  share: async (postId, userId) => {
    try {
      // Increment share count
      const params = {
        TableName: TABLES.POSTS,
        Key: { postId },
        UpdateExpression: 'ADD sharesCount :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      const result = await dynamoDb.update(params);
      return { 
        success: true, 
        sharesCount: result.Attributes.sharesCount 
      };
    } catch (error) {
      console.error('Error sharing post:', error);
      throw error;
    }
  }
};

module.exports = Post;