// controllers/postController.js
const Post = require('../models/Post');
const User = require('../models/User');
const { s3Service } = require('../services/s3Service');
const { snsService } = require('../services/snsService');
const { elasticsearchService } = require('../services/elasticsearchService');
const { validationResult } = require('express-validator');

const postController = {
  // Create a new post
  createPost: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { content, tags } = req.body;
      const userId = req.user.userId;
      
      // Process media files if any
      let mediaUrls = [];
      let mediaType = 'none';
      
      if (req.files && req.files.length > 0) {
        // Images were uploaded
        mediaUrls = req.files.map(file => file.location);
        mediaType = 'image';
      } else if (req.file) {
        // Video was uploaded
        mediaUrls = [req.file.location];
        mediaType = 'video';
      }
      
      // Create post in database
      const post = await Post.create({
        userId,
        content,
        mediaUrls,
        mediaType,
        tags: tags ? JSON.parse(tags) : []
      });
      
      // Index post in ElasticSearch for searching
      try {
        // await elasticsearchService.indexDocument('posts', post.postId, {
        //   userId,
        //   content,
        //   tags: post.tags,
        //   timestamp: post.timestamp
        // });
      } catch (esError) {
        console.error('Error indexing post:', esError);
        // Continue even if indexing fails
      }
      
      res.status(201).json({
        message: 'Post created successfully',
        post
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get a single post by ID
  getPost: async (req, res) => {
    try {
      const { postId } = req.params;
      
      // Get post from database
      const post = await Post.getById(postId);
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // Get author details
      const author = await User.getById(post.userId);
      
      // Format response
      const response = {
        ...post,
        author: {
          userId: author.userId,
          username: author.username,
          profilePicture: author.profilePicture
        }
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get user's posts
  getUserPosts: async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 20, lastKey } = req.query;
      
      // Parse lastKey if provided
      let lastEvaluatedKey = null;
      if (lastKey) {
        try {
          lastEvaluatedKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        } catch (parseError) {
          return res.status(400).json({ message: 'Invalid lastKey format' });
        }
      }
      
      // Get posts from database
      const result = await Post.getByUserId(userId, parseInt(limit), lastEvaluatedKey);
      
      // Get author details
      const author = await User.getById(userId);
      
      if (!author) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Format response
      const posts = result.posts.map(post => ({
        ...post,
        author: {
          userId: author.userId,
          username: author.username,
          profilePicture: author.profilePicture
        }
      }));
      
      // Encode lastEvaluatedKey for pagination
      let nextKey = null;
      if (result.lastEvaluatedKey) {
        nextKey = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
      }
      
      res.status(200).json({
        posts,
        nextKey
      });
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get timeline posts (from followed users)
  getTimelinePosts: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { limit = 20 } = req.query;
      
      // Get user's following list
      const following = await User.getFollowing(userId);
      
      // Add the user's own ID to get their posts too
      const userIds = [...following, userId];
      
      // Get posts from database
      const posts = await Post.getTimelinePosts(userIds, parseInt(limit));
      
      // Get user details for each post
      const uniqueUserIds = [...new Set(posts.map(post => post.userId))];
      
      // Get all users in a single batch
      const userPromises = uniqueUserIds.map(id => User.getById(id));
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
      const formattedPosts = posts.map(post => ({
        ...post,
        author: userMap[post.userId] || { userId: post.userId, username: 'Unknown' }
      }));
      
      res.status(200).json({
        posts: formattedPosts
      });
    } catch (error) {
      console.error('Get timeline posts error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Update a post
  updatePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const { content, tags } = req.body;
      const userId = req.user.userId;
      
      // Get the existing post
      const existingPost = await Post.getById(postId);
      
      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // Verify ownership
      if (existingPost.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this post' });
      }
      
      // Update post in database
      const updates = {};
      
      if (content !== undefined) {
        updates.content = content;
      }
      
      if (tags !== undefined) {
        updates.tags = JSON.parse(tags);
      }
      
      const updatedPost = await Post.update(postId, userId, updates);
      
      // Update post in ElasticSearch
      try {
        await elasticsearchService.indexDocument('posts', postId, {
          userId,
          content: updatedPost.content,
          tags: updatedPost.tags,
          timestamp: updatedPost.timestamp
        });
      } catch (esError) {
        console.error('Error updating post in ElasticSearch:', esError);
        // Continue even if indexing fails
      }
      
      res.status(200).json({
        message: 'Post updated successfully',
        post: updatedPost
      });
    } catch (error) {
      console.error('Update post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Delete a post
  deletePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.userId;
      
      // Get the existing post
      const existingPost = await Post.getById(postId);
      
      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // Verify ownership
      if (existingPost.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this post' });
      }
      
      // Delete media files from S3 if any
      if (existingPost.mediaUrls && existingPost.mediaUrls.length > 0) {
        const deletePromises = existingPost.mediaUrls.map(url => {
          // Extract key from S3 URL
          const urlParts = url.split('/');
          const key = urlParts.slice(3).join('/');
          
          // Determine bucket based on media type
          const bucket = existingPost.mediaType === 'video' 
            ? s3Service.BUCKETS.VIDEOS 
            : s3Service.BUCKETS.IMAGES;
          
          return s3Service.deleteFile(key, bucket);
        });
        
        // Delete all media files in parallel
        await Promise.all(deletePromises);
      }
      
      // Delete post from database
      await Post.delete(postId, userId);
      
      // Delete post from ElasticSearch
      try {
        await elasticsearchService.deleteDocument('posts', postId);
      } catch (esError) {
        console.error('Error deleting post from ElasticSearch:', esError);
        // Continue even if deletion fails
      }
      
      res.status(200).json({
        message: 'Post deleted successfully'
      });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Like a post
  likePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.userId;
      
      // Like the post
      const result = await Post.like(postId, userId);
      
      // Get post and post owner details for notification
      const post = await Post.getById(postId);
      
      // Send notification to post owner if it's not the same user
      if (post && post.userId !== userId) {
        try {
          // Get user details for the notification
          const user = await User.getById(userId);
          
          // Create notification message
          const notificationMessage = {
            type: 'like',
            senderId: userId,
            recipientId: post.userId,
            contentId: postId,
            contentType: 'post',
            message: `${user.username} liked your post`,
            timestamp: new Date().toISOString()
          };
          
          // Send to SNS
          await snsService.publishNotification(notificationMessage);
          
          // Also emit via socket.io for real-time updates
          req.app.get('io').to(post.userId).emit('notification', notificationMessage);
        } catch (notifError) {
          console.error('Notification error:', notifError);
          // Continue even if notification fails
        }
      }
      
      res.status(200).json({
        message: 'Post liked successfully',
        likesCount: result.likesCount
      });
    } catch (error) {
      console.error('Like post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Unlike a post
  unlikePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.userId;
      
      // Unlike the post
      const result = await Post.unlike(postId, userId);
      
      res.status(200).json({
        message: 'Post unliked successfully',
        likesCount: result.likesCount
      });
    } catch (error) {
      console.error('Unlike post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Share a post
  sharePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.userId;
      
      // Increment share count
      const result = await Post.share(postId, userId);
      
      // Get post and post owner details for notification
      const post = await Post.getById(postId);
      
      // Send notification to post owner if it's not the same user
      if (post && post.userId !== userId) {
        try {
          // Get user details for the notification
          const user = await User.getById(userId);
          
          // Create notification message
          const notificationMessage = {
            type: 'share',
            senderId: userId,
            recipientId: post.userId,
            contentId: postId,
            contentType: 'post',
            message: `${user.username} shared your post`,
            timestamp: new Date().toISOString()
          };
          
          // Send to SNS
          await snsService.publishNotification(notificationMessage);
          
          // Also emit via socket.io for real-time updates
          req.app.get('io').to(post.userId).emit('notification', notificationMessage);
        } catch (notifError) {
          console.error('Notification error:', notifError);
          // Continue even if notification fails
        }
      }
      
      res.status(200).json({
        message: 'Post shared successfully',
        sharesCount: result.sharesCount
      });
    } catch (error) {
      console.error('Share post error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Search posts
  searchPosts: async (req, res) => {
    try {
      const { query, limit = 20 } = req.query;
      
      if (!query || query.trim() === '') {
        return res.status(400).json({ message: 'Search query is required' });
      }
      
      // Search posts in ElasticSearch
      const searchResults = await elasticsearchService.searchPosts(query, parseInt(limit));
      
      // Get full post details from DynamoDB
      const postIds = searchResults.map(result => result.id);
      
      // Get posts in batches of 25 (DynamoDB batch limit)
      const posts = [];
      for (let i = 0; i < postIds.length; i += 25) {
        const batch = postIds.slice(i, i + 25);
        const batchRequests = batch.map(id => Post.getById(id));
        const batchResults = await Promise.all(batchRequests);
        posts.push(...batchResults.filter(p => p)); // Filter out any null results
      }
      
      // Get user details for each post
      const uniqueUserIds = [...new Set(posts.map(post => post.userId))];
      
      // Get all users in a single batch
      const userPromises = uniqueUserIds.map(id => User.getById(id));
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
      const formattedPosts = posts.map(post => ({
        ...post,
        author: userMap[post.userId] || { userId: post.userId, username: 'Unknown' }
      }));
      
      res.status(200).json({
        posts: formattedPosts
      });
    } catch (error) {
      console.error('Search posts error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = postController;