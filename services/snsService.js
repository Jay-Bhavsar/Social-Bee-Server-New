// services/snsService.js
const { sns } = require('../config/aws');

// SNS topic ARNs
const TOPICS = {
  NOTIFICATIONS: process.env.SNS_NOTIFICATIONS_TOPIC || 'arn:aws:sns:region:account-id:SocialMediaNotifications'
};

// SNS service for push notifications
const snsService = {
  // Publish notification to SNS topic
  publishNotification: async (message, topicArn = TOPICS.NOTIFICATIONS) => {
    try {
      const params = {
        Message: JSON.stringify(message),
        TopicArn: topicArn
      };
      
      const result = await sns.publish(params).promise();
      return result.MessageId;
    } catch (error) {
      console.error('SNS publish error:', error);
      throw error;
    }
  },
  
  // Create platform endpoint for mobile push notifications
  createPlatformEndpoint: async (token, platformApplicationArn) => {
    try {
      const params = {
        PlatformApplicationArn: platformApplicationArn,
        Token: token
      };
      
      const result = await sns.createPlatformEndpoint(params).promise();
      return result.EndpointArn;
    } catch (error) {
      console.error('SNS create endpoint error:', error);
      throw error;
    }
  },
  
  // Delete platform endpoint
  deletePlatformEndpoint: async (endpointArn) => {
    try {
      const params = {
        EndpointArn: endpointArn
      };
      
      await sns.deleteEndpoint(params).promise();
      return true;
    } catch (error) {
      console.error('SNS delete endpoint error:', error);
      throw error;
    }
  }
};

module.exports = {
  snsService,
  TOPICS
};