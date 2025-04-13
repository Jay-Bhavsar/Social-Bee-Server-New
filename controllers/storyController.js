// controllers/storyController.js
const Story = require('../models/Story');
const User = require('../models/User');
const { s3Service } = require('../services/s3Service');
const { validationResult } = require('express-validator');

const storyController = {
  // Create a new story
  createStory: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { caption } = req.body;
      const userId = req.user.userId;
      
      // Ensure media was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Media file is required for a story' });
      }
      
      // Determine media type
      const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      
      // Create story in database
      const story = await Story.create({
        userId,
        mediaUrl: req.file.location,
        mediaType,
        caption: caption || ''
      });
      
      res.status(201).json({
        message: 'Story created successfully',
        story
      });
    } catch (error) {
      console.error('Create story error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get a user's stories
  getUserStories: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get stories from database
      const stories = await Story.getByUserId(userId);
      
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
        stories
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get user stories error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get stories feed (stories from followed users)
  getStoriesFeed: async (req, res) => {
    try {
      const userId = req.user.userId;
      
      // Get user's following list
      const following = await User.getFollowing(userId);
      
      // Add the user's own ID to get their stories too
      const userIds = [...following, userId];
      
      // Get stories from database
      const storiesByUser = await Story.getStoriesFeed(userIds);
      
      // Get user details for each set of stories
      const userPromises = Object.keys(storiesByUser).map(id => User.getById(id));
      const users = await Promise.all(userPromises);
      
      // Create a map for fast lookup
      const userMap = {};
      users.forEach(user => {
        if (user) {
          userMap[user.userId] = {
            userId: user.userId,
            username: user.username,
            profilePicture: user.profilePicture
          };
        }
      });
      
      // Format response
      const formattedStories = Object.entries(storiesByUser).map(([userId, stories]) => ({
        user: userMap[userId] || { userId, username: 'Unknown' },
        stories
      }));
      
      res.status(200).json({
        feed: formattedStories
      });
    } catch (error) {
      console.error('Get stories feed error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Mark a story as viewed
  viewStory: async (req, res) => {
    try {
      const { storyId } = req.params;
      const userId = req.user.userId;
      
      // Mark story as viewed
      await Story.markAsViewed(storyId, userId);
      
      res.status(200).json({
        message: 'Story marked as viewed'
      });
    } catch (error) {
      console.error('View story error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Delete a story
  deleteStory: async (req, res) => {
    try {
      const { storyId } = req.params;
      const userId = req.user.userId;
      
      // Get the existing story
      const existingStory = await Story.getById(storyId);
      
      if (!existingStory) {
        return res.status(404).json({ message: 'Story not found' });
      }
      
      // Verify ownership
      if (existingStory.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this story' });
      }
      
      // Delete media file from S3
      if (existingStory.mediaUrl) {
        // Extract key from S3 URL
        const urlParts = existingStory.mediaUrl.split('/');
        const key = urlParts.slice(3).join('/');
        
        // Determine bucket based on media type
        const bucket = existingStory.mediaType === 'video' 
          ? s3Service.BUCKETS.VIDEOS 
          : s3Service.BUCKETS.IMAGES;
        
        await s3Service.deleteFile(key, bucket);
      }
      
      // Delete story from database
      await Story.delete(storyId, userId);
      
      res.status(200).json({
        message: 'Story deleted successfully'
      });
    } catch (error) {
      console.error('Delete story error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = storyController;