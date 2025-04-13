// config/dynamodb.js
const { dynamoDB } = require('./aws');

// Table names
const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'SocialMedia_Users',
  POSTS: process.env.DYNAMODB_POSTS_TABLE || 'SocialMedia_Posts',
  INTERACTIONS: process.env.DYNAMODB_INTERACTIONS_TABLE || 'SocialMedia_Interactions',
  STORIES: process.env.DYNAMODB_STORIES_TABLE || 'SocialMedia_Stories'
};

// Common DynamoDB operations
const dynamoDb = {
  // Get item by ID
  get: async (params) => {
    try {
      const result = await dynamoDB.get(params).promise();
      return result.Item;
    } catch (error) {
      console.error('DynamoDB get error:', error);
      throw error;
    }
  },
  
  // Put new item
  put: async (params) => {
    try {
      await dynamoDB.put(params).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB put error:', error);
      throw error;
    }
  },
  
  // Update existing item
  update: async (params) => {
    try {
      const result = await dynamoDB.update(params).promise();
      return result;
    } catch (error) {
      console.error('DynamoDB update error:', error);
      throw error;
    }
  },
  
  // Delete item
  delete: async (params) => {
    try {
      await dynamoDB.delete(params).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      throw error;
    }
  },
  
  // Query items
  query: async (params) => {
    try {
      const result = await dynamoDB.query(params).promise();
      return result.Items;
    } catch (error) {
      console.error('DynamoDB query error:', error);
      throw error;
    }
  },
  
  // Scan table
  scan: async (params) => {
    try {
      const result = await dynamoDB.scan(params).promise();
      return result.Items;
    } catch (error) {
      console.error('DynamoDB scan error:', error);
      throw error;
    }
  },
  
  // Batch get items
  batchGet: async (params) => {
    try {
      const result = await dynamoDB.batchGet(params).promise();
      return result.Responses;
    } catch (error) {
      console.error('DynamoDB batchGet error:', error);
      throw error;
    }
  },
  
  // Batch write items
  batchWrite: async (params) => {
    try {
      await dynamoDB.batchWrite(params).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB batchWrite error:', error);
      throw error;
    }
  },
  
  // Transaction operations
  transactWrite: async (params) => {
    try {
      await dynamoDB.transactWrite(params).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB transactWrite error:', error);
      throw error;
    }
  }
};

module.exports = {
  dynamoDb,
  TABLES
};