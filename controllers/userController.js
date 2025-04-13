// controllers/userController.js
const User = require('../models/User');
const { s3Service } = require('../services/s3Service');
const { elasticsearchService } = require('../services/elasticsearchService');
const { validationResult } = require('express-validator');

const userController = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get user from database
      const user = await User.getById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Format response (exclude sensitive data)
      const profile = {
        userId: user.userId,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        followersCount: user.followers ? user.followers.length : 0,
        followingCount: user.following ? user.following.length : 0,
        createdAt: user.createdAt
      };
      
      // Check if the requesting user is following this user
      let isFollowing = false;
      if (req.user && req.user.userId !== userId) {
        const reqUserFollowing = await User.getFollowing(req.user.userId);
        isFollowing = reqUserFollowing.includes(userId);
      }
      
      res.status(200).json({
        profile,
        isFollowing
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Update user profile
  updateProfile: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const userId = req.user.userId;
      const { username, bio } = req.body;
      
      // Check if username is already taken (if username is provided)
      if (username) {
        const existingUser = await User.getByUsername(username);
        if (existingUser && existingUser.userId !== userId) {
          return res.status(400).json({ message: 'Username is already taken' });
        }
      }
      
      // Update profile in database
      const updates = {};
      
      if (username) updates.username = username;
      if (bio !== undefined) updates.bio = bio;
      
      const updatedUser = await User.update(userId, updates);
      
      // Index user in ElasticSearch for search
      try {
        await elasticsearchService.indexDocument('users', userId, {
          userId,
          username: updatedUser.username,
          bio: updatedUser.bio
        });
      } catch (esError) {
        console.error('Error indexing user:', esError);
        // Continue even if indexing fails
      }
      
      res.status(200).json({
        message: 'Profile updated successfully',
        user: {
          userId: updatedUser.userId,
          username: updatedUser.username,
          email: updatedUser.email,
          profilePicture: updatedUser.profilePicture,
          bio: updatedUser.bio
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Update profile picture
  updateProfilePicture: async (req, res) => {
    try {
      const userId = req.user.userId;
      
      // Ensure image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Profile picture is required' });
      }
      
      // Get the existing user
      const existingUser = await User.getById(userId);
      
      // Delete old profile picture if it exists
      if (existingUser.profilePicture) {
        try {
          // Extract key from S3 URL
          const urlParts = existingUser.profilePicture.split('/');
          const key = urlParts.slice(3).join('/');
          
          await s3Service.deleteFile(key, s3Service.BUCKETS.PROFILE_PICTURES);
        } catch (deleteError) {
          console.error('Error deleting old profile picture:', deleteError);
          // Continue even if deletion fails
        }
      }
      
      // Update profile picture in database
      const updatedUser = await User.update(userId, {
        profilePicture: req.file.location
      });
      
      res.status(200).json({
        message: 'Profile picture updated successfully',
        profilePicture: updatedUser.profilePicture
      });
    } catch (error) {
      console.error('Update profile picture error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Follow a user
  followUser: async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const userId = req.user.userId;
      
      // Can't follow yourself
      if (targetUserId === userId) {
        return res.status(400).json({ message: 'You cannot follow yourself' });
      }
      
      // Check if target user exists
      const targetUser = await User.getById(targetUserId);
      
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Follow user
      await User.followUser(userId, targetUserId);
      
      res.status(200).json({
        message: `You are now following ${targetUser.username}`
      });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Unfollow a user
  unfollowUser: async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const userId = req.user.userId;
      
      // Can't unfollow yourself
      if (targetUserId === userId) {
        return res.status(400).json({ message: 'You cannot unfollow yourself' });
      }
      
      // Check if target user exists
      const targetUser = await User.getById(targetUserId);
      
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Unfollow user
      await User.unfollowUser(userId, targetUserId);
      
      res.status(200).json({
        message: `You have unfollowed ${targetUser.username}`
      });
    } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get user followers
  getFollowers: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await User.getById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get followers
      const followerIds = await User.getFollowers(userId);
      
      // Get follower details
      const followers = [];
      
      for (const followerId of followerIds) {
        const follower = await User.getById(followerId);
        if (follower) {
          followers.push({
            userId: follower.userId,
            username: follower.username,
            profilePicture: follower.profilePicture
          });
        }
      }
      
      res.status(200).json({
        followers
      });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get user's following list
  getFollowing: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await User.getById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get following
      const followingIds = await User.getFollowing(userId);
      
      // Get following details
      const following = [];
      
      for (const followingId of followingIds) {
        const followedUser = await User.getById(followingId);
        if (followedUser) {
          following.push({
            userId: followedUser.userId,
            username: followedUser.username,
            profilePicture: followedUser.profilePicture
          });
        }
      }
      
      res.status(200).json({
        following
      });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Search users
  searchUsers: async (req, res) => {
    try {
      const { query, limit = 20 } = req.query;
      
      if (!query || query.trim() === '') {
        return res.status(400).json({ message: 'Search query is required' });
      }
      
      // Search users in ElasticSearch
      const searchResults = await elasticsearchService.searchUsers(query, parseInt(limit));
      
      // Format response
      const users = searchResults.map(result => ({
        userId: result.userId,
        username: result.username,
        profilePicture: result.profilePicture || null,
        bio: result.bio || ''
      }));
      
      res.status(200).json({
        users
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get suggested users to follow
  getSuggestedUsers: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { limit = 10 } = req.query;
      
      // Get user's following list
      const following = await User.getFollowing(userId);
      
      // Simple algorithm: get users who are not already followed
      // In production, you would use a more sophisticated recommendation algorithm
      const params = {
        TableName: 'SocialMedia_Users',
        Limit: parseInt(limit) + following.length + 1 // Add extra to account for filtering
      };
      
      // This is a simplified approach - in production you would use a more efficient query
      const allUsers = []; // Would be populated from actual database query
      
      // Filter out the current user and already followed users
      const suggestedUsers = allUsers
        .filter(user => user.userId !== userId && !following.includes(user.userId))
        .slice(0, parseInt(limit))
        .map(user => ({
          userId: user.userId,
          username: user.username,
          profilePicture: user.profilePicture
        }));
      
      res.status(200).json({
        users: suggestedUsers
      });
    } catch (error) {
      console.error('Get suggested users error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = userController;