// scripts/createTables.js - Script to create DynamoDB tables

const AWS = require('aws-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB();

// Table names
const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'SocialMedia_Users',
  POSTS: process.env.DYNAMODB_POSTS_TABLE || 'SocialMedia_Posts',
  INTERACTIONS: process.env.DYNAMODB_INTERACTIONS_TABLE || 'SocialMedia_Interactions',
  STORIES: process.env.DYNAMODB_STORIES_TABLE || 'SocialMedia_Stories'
};

// Create Users table
async function createUsersTable() {
  const params = {
    TableName: TABLES.USERS,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'username', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UsernameIndex',
        KeySchema: [
          { AttributeName: 'username', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    const result = await dynamodb.createTable(params).promise();
    console.log('Users table created:', result);
    return result;
  } catch (error) {
    console.error('Error creating Users table:', error);
    throw error;
  }
}

// Create Posts table
async function createPostsTable() {
  const params = {
    TableName: TABLES.POSTS,
    KeySchema: [
      { AttributeName: 'postId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'postId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    const result = await dynamodb.createTable(params).promise();
    console.log('Posts table created:', result);
    return result;
  } catch (error) {
    console.error('Error creating Posts table:', error);
    throw error;
  }
}

// Create Interactions table
async function createInteractionsTable() {
  const params = {
    TableName: TABLES.INTERACTIONS,
    KeySchema: [
      { AttributeName: 'interactionId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'interactionId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'contentId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' },
      { AttributeName: 'parentId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserContentIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'ContentIndex',
        KeySchema: [
          { AttributeName: 'contentId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'ParentIndex',
        KeySchema: [
          { AttributeName: 'parentId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    const result = await dynamodb.createTable(params).promise();
    console.log('Interactions table created:', result);
    return result;
  } catch (error) {
    console.error('Error creating Interactions table:', error);
    throw error;
  }
}

// Create Stories/Reels table
async function createStoriesTable() {
  const params = {
    TableName: TABLES.STORIES,
    KeySchema: [
      { AttributeName: 'contentId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'contentId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    const result = await dynamodb.createTable(params).promise();
    console.log('Stories table created:', result);
    return result;
  } catch (error) {
    console.error('Error creating Stories table:', error);
    throw error;
  }
}

// Main function to create all tables
async function createAllTables() {
  try {
    await createUsersTable();
    await createPostsTable();
    await createInteractionsTable();
    await createStoriesTable();
    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Run the script
createAllTables();