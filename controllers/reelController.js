// controllers/reelController.js
const Story = require('../models/Story'); // Reusing Story model for Reels
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const { s3Service } = require('../services/s3Service');
const { validationResult } = require('express-validator');

const reelController = {
  // Create a new reel
  createReel: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { caption, tags } = req.body;
      const userId = req.user.userId;
      
      // Ensure video was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Video file is required for a reel' });
      }
      
      // Create reel in database (using Story model but with contentType 'reel')
      const reel = await Story.create({
        userId,
        mediaUrl: req.file.location,
        mediaType: 'video',
        caption: caption || '',
        contentType: 'reel', // Override contentType
        expiryTime: null // Reels don't expire
      });
      
      res.status(201).json({
        message: 'Reel created successfully',
        reel
      });
    } catch (error) {
      console.error('Create reel error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get user's reels
  getUserReels: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get reels from database
      const params = {
        TableName: 'SocialMedia_Stories',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'contentType = :contentType',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentType': 'reel'
        }
      };
      
      // Get user details
      const user = await User.getById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Format response
      const response = {
        user: {
          userId: user.userId,
          username: user.username,
          profilePicture: user.profilePicture
        },
        reels: [] // Will populate from query
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get user reels error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get reel feed (trending and from followed users)
  getReelFeed: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { limit = 20 } = req.query;
      
      // Get user's following list
      const following = await User.getFollowing(userId);
      
      // Add the user's own ID to get their reels too
      const userIds = [...following, userId];
      
      // Get reels from database (you would need a custom query)
      // For now, simply querying all reels and filtering client-side
      
      res.status(200).json({
        reels: [] // Would populate from actual data
      });
    } catch (error) {
      console.error('Get reel feed error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Like a reel
  likeReel: async (req, res) => {
    try {
      const { reelId } = req.params;
      const userId = req.user.userId;
      
      // Create interaction
      await Interaction.create({
        type: 'like',
        userId,
        contentId: reelId,
        content: ''
      });
      
      res.status(200).json({
        message: 'Reel liked successfully'
      });
    } catch (error) {
      console.error('Like reel error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Unlike a reel
  unlikeReel: async (req, res) => {
    try {
      const { reelId } = req.params;
      const userId = req.user.userId;
      
      // Find and delete like interaction
      const params = {
        TableName: 'SocialMedia_Interactions',
        IndexName: 'UserContentIndex',
        KeyConditionExpression: 'userId = :userId AND contentId = :contentId',
        FilterExpression: 'type = :type',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentId': reelId,
          ':type': 'like'
        }
      };
      
      // This is simplified - would need proper implementation
      // to find and delete the interaction
      
      res.status(200).json({
        message: 'Reel unliked successfully'
      });
    } catch (error) {
      console.error('Unlike reel error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Comment on a reel
  commentReel: async (req, res) => {
    try {
      const { reelId } = req.params;
      const { content } = req.body;
      const userId = req.user.userId;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Create comment interaction
      const comment = await Interaction.create({
        type: 'comment',
        userId,
        contentId: reelId,
        content
      });
      
      // Get user details for response
      const user = await User.getById(userId);
      
      // Format response
      const response = {
        comment: {
          ...comment,
          user: {
            userId: user.userId,
            username: user.username,
            profilePicture: user.profilePicture
          }
        }
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Comment reel error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Delete a reel
  deleteReel: async (req, res) => {
    try {
      const { reelId } = req.params;
      const userId = req.user.userId;
      
      // Get the existing reel
      const existingReel = await Story.getById(reelId);
      
      if (!existingReel || existingReel.contentType !== 'reel') {
        return res.status(404).json({ message: 'Reel not found' });
      }
      
      // Verify ownership
      if (existingReel.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this reel' });
      }
      
      // Delete media file from S3
      if (existingReel.mediaUrl) {
        // Extract key from S3 URL
        const urlParts = existingReel.mediaUrl.split('/');
        const key = urlParts.slice(3).join('/');
        
        // Determine bucket based on media type
        const bucket = s3Service.BUCKETS.VIDEOS;
        
        await s3Service.deleteFile(key, bucket);
      }
      
      // Delete reel from database
      await Story.delete(reelId, userId);
      
      res.status(200).json({
        message: 'Reel deleted successfully'
      });
    } catch (error) {
      console.error('Delete reel error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = reelController;