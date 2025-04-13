// config/index.js - Central configuration management
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables based on NODE_ENV
const loadEnvConfig = () => {
  const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : process.env.NODE_ENV === 'staging' 
      ? '.env.staging' 
      : '.env.development';
  
  // Load default .env file
  dotenv.config();
  
  // Override with environment-specific settings
  dotenv.config({ 
    path: path.resolve(process.cwd(), envFile),
    override: true
  });
};

// Load environment configuration
loadEnvConfig();

// Application configuration
const config = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS 
      ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3001']
  },
  
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '1h',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'social-media-app',
    audience: process.env.JWT_AUDIENCE || 'social-media-users'
  },
  
  // AWS configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    
    // DynamoDB tables
    dynamodb: {
      usersTable: process.env.DYNAMODB_USERS_TABLE || 'SocialMedia_Users',
      postsTable: process.env.DYNAMODB_POSTS_TABLE || 'SocialMedia_Posts',
      interactionsTable: process.env.DYNAMODB_INTERACTIONS_TABLE || 'SocialMedia_Interactions',
      storiesTable: process.env.DYNAMODB_STORIES_TABLE || 'SocialMedia_Stories',
      notificationsTable: process.env.DYNAMODB_NOTIFICATIONS_TABLE || 'SocialMedia_Notifications'
    },
    
    // S3 buckets
    s3: {
      imagesBucket: process.env.S3_IMAGES_BUCKET || 'social-media-images',
      videosBucket: process.env.S3_VIDEOS_BUCKET || 'social-media-videos',
      profilePicturesBucket: process.env.S3_PROFILE_PICTURES_BUCKET || 'social-media-profile-pictures'
    },
    
    // Cognito
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID
    },
    
    // SNS topics
    sns: {
      notificationsTopic: process.env.SNS_NOTIFICATIONS_TOPIC
    },
    
    // ElasticSearch
    elasticsearch: {
      domain: process.env.ES_DOMAIN
    },
    
    // CloudFront
    cloudfront: {
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      url: process.env.CLOUDFRONT_URL
    }
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
    enableCloudWatch: process.env.ENABLE_CLOUDWATCH_LOGS === 'true',
    cloudWatchLogGroup: process.env.CLOUDWATCH_LOG_GROUP || 'SocialMediaAppLogs'
  },
  
  // Security configuration
  security: {
    enableCsrf: process.env.ENABLE_CSRF === 'true',
    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      windowSizeInSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SIZE || '60')
    },
    encryptionKey: process.env.DATA_ENCRYPTION_KEY
  },
  
  // Media configuration
  media: {
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || '5242880'), // 5MB
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE || '104857600'), // 100MB
    maxProfilePictureSize: parseInt(process.env.MAX_PROFILE_PICTURE_SIZE || '2097152'), // 2MB
    allowedImageTypes: process.env.ALLOWED_IMAGE_TYPES 
      ? process.env.ALLOWED_IMAGE_TYPES.split(',') 
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    allowedVideoTypes: process.env.ALLOWED_VIDEO_TYPES
      ? process.env.ALLOWED_VIDEO_TYPES.split(',')
      : ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']
  },
  
  // Monitoring configuration
  monitoring: {
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false'
  }
};

// Validate required configuration
const validateConfig = () => {
  const requiredVars = [
    'jwt.secret',
    'aws.accessKeyId', 
    'aws.secretAccessKey'
  ];
  
  const missingVars = [];
  
  const checkNestedProperty = (obj, path) => {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null || current[part] === '') {
        return false;
      }
      current = current[part];
    }
    
    return true;
  };
  
  for (const varPath of requiredVars) {
    if (!checkNestedProperty(config, varPath)) {
      missingVars.push(varPath);
    }
  }
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required configuration variables: ${missingVars.join(', ')}`);
  }
  
  return true;
};

// Export as frozen object to prevent modification
module.exports = Object.freeze(config);

// Validate config when imported
validateConfig();