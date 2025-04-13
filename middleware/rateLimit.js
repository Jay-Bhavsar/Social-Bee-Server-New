// middleware/rateLimit.js - Rate limiting to prevent abuse
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * Rate limiting middleware to prevent API abuse
 * Uses DynamoDB to track request counts across distributed servers
 */
const rateLimiter = (options = {}) => {
  const {
    tableName = 'SocialMedia_RateLimiting',
    maxRequests = 100,
    windowSizeInSeconds = 60,
    identifierKey = 'ip'
  } = options;
  
  return async (req, res, next) => {
    try {
      // Get identifier (IP address, user ID, etc.)
      let identifier;
      
      if (identifierKey === 'ip') {
        identifier = req.ip || req.connection.remoteAddress;
      } else if (identifierKey === 'userId' && req.user) {
        identifier = req.user.userId;
      } else {
        identifier = req.ip || req.connection.remoteAddress;
      }
      
      const routeKey = req.method + req.baseUrl + req.path;
      const recordId = `${identifier}:${routeKey}`;
      
      // Current timestamp
      const now = Math.floor(Date.now() / 1000);
      
      // Window start timestamp
      const windowStart = now - windowSizeInSeconds;
      
      // Get the current count record from DynamoDB
      const getParams = {
        TableName: tableName,
        Key: { id: recordId }
      };
      
      const record = await dynamoDB.get(getParams).promise();
      const existingRecord = record.Item;
      
      if (existingRecord && existingRecord.timestamp > windowStart) {
        // Record exists and is within the current window
        if (existingRecord.count >= maxRequests) {
          // Rate limit exceeded
          return res.status(429).json({
            message: 'Too many requests, please try again later'
          });
        }
        
        // Update the record with incremented count
        const updateParams = {
          TableName: tableName,
          Key: { id: recordId },
          UpdateExpression: 'SET #count = #count + :inc',
          ExpressionAttributeNames: {
            '#count': 'count'
          },
          ExpressionAttributeValues: {
            ':inc': 1
          }
        };
        
        await dynamoDB.update(updateParams).promise();
      } else {
        // Create a new record
        const putParams = {
          TableName: tableName,
          Item: {
            id: recordId,
            count: 1,
            timestamp: now,
            expiryTime: now + (windowSizeInSeconds * 2) // TTL for automatic cleanup
          }
        };
        
        await dynamoDB.put(putParams).promise();
      }
      
      // Set rate limit headers
      if (existingRecord) {
        res.set('X-RateLimit-Limit', maxRequests.toString());
        res.set('X-RateLimit-Remaining', (maxRequests - existingRecord.count - 1).toString());
        const resetTime = existingRecord.timestamp + windowSizeInSeconds - now;
        res.set('X-RateLimit-Reset', resetTime.toString());
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue even if rate limiting fails
      next();
    }
  };
};

module.exports = rateLimiter;
