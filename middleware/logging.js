
// middleware/logging.js - Enhanced logging for security and monitoring
const winston = require('winston');
const AWS = require('aws-sdk');
const cloudWatchLogs = new AWS.CloudWatchLogs();

// Create a custom Winston transport for CloudWatch Logs
class CloudWatchTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    this.logGroupName = options.logGroupName || 'SocialMediaAppLogs';
    this.logStreamName = options.logStreamName || `app-logs-${new Date().toISOString().split('T')[0]}`;
    this.sequenceToken = null;
    
    // Create log group and stream if they don't exist
    this.initializeLogGroup();
  }
  
  async initializeLogGroup() {
    try {
      // Create log group if it doesn't exist
      try {
        await cloudWatchLogs.createLogGroup({ logGroupName: this.logGroupName }).promise();
      } catch (error) {
        // Ignore if log group already exists
        if (error.code !== 'ResourceAlreadyExistsException') {
          console.error('Error creating CloudWatch log group:', error);
        }
      }
      
      // Create log stream if it doesn't exist
      try {
        await cloudWatchLogs.createLogStream({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName
        }).promise();
      } catch (error) {
        // Ignore if log stream already exists
        if (error.code !== 'ResourceAlreadyExistsException') {
          console.error('Error creating CloudWatch log stream:', error);
        }
      }
    } catch (error) {
      console.error('Error initializing CloudWatch Logs:', error);
    }
  }
  
  async log(info, callback) {
    try {
      const logEvent = {
        message: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: info.level,
          message: info.message,
          ...(info.meta || {})
        }),
        timestamp: Date.now()
      };
      
      const params = {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent]
      };
      
      // Add sequence token if we have one
      if (this.sequenceToken) {
        params.sequenceToken = this.sequenceToken;
      }
      
      // Send logs to CloudWatch
      const result = await cloudWatchLogs.putLogEvents(params).promise();
      this.sequenceToken = result.nextSequenceToken;
      
      callback();
    } catch (error) {
      // Handle invalid sequence token
      if (error.code === 'InvalidSequenceTokenException') {
        // Extract the correct sequence token from the error
        const match = error.message.match(/The next expected sequenceToken is: (.+)/);
        if (match && match[1]) {
          this.sequenceToken = match[1];
          // Retry with correct token
          this.log(info, callback);
          return;
        }
      }
      
      console.error('Error sending logs to CloudWatch:', error);
      callback();
    }
  }
}

// Configure Winston logger
const configureLogger = (options = {}) => {
  const {
    enableConsole = true,
    enableCloudWatch = process.env.ENABLE_CLOUDWATCH_LOGS === 'true',
    logLevel = process.env.LOG_LEVEL || 'info'
  } = options;
  
  const transports = [];
  
  // Add console transport
  if (enableConsole) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    }));
  }
  
  // Add CloudWatch Logs transport
  if (enableCloudWatch) {
    transports.push(new CloudWatchTransport({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP || 'SocialMediaAppLogs',
      logStreamName: `${process.env.NODE_ENV || 'development'}-${new Date().toISOString().split('T')[0]}`
    }));
  }
  
  // Create logger
  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports
  });
  
  // Create Express middleware
  const loggerMiddleware = (req, res, next) => {
    // Log request
    logger.info('API Request', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user ? req.user.userId : 'anonymous'
    });
    
    // Log response
    const originalSend = res.send;
    res.send = function(body) {
      const responseTime = Date.now() - req.requestTimestamp;
      
      logger.info('API Response', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        userId: req.user ? req.user.userId : 'anonymous'
      });
      
      originalSend.call(this, body);
    };
    
    next();
  };
  
  return {
    logger,
    loggerMiddleware
  };
};

module.exports = configureLogger;
