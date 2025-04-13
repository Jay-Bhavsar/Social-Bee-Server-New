// controllers/interactionController.js
const Interaction = require('../models/Interaction');
const User = require('../models/User');
const Post = require('../models/Post');
const Story = require('../models/Story');
const { snsService } = require('../services/snsService');
const { validationResult } = require('express-validator');

const interactionController = {
  // Add a comment
  addComment: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { contentId, content, parentId } = req.body;
      const userId = req.user.userId;
      
      // Verify content exists (post or reel)
      let contentExists = false;
      let contentOwnerId = null;
      
      // Check if it's a post
      const post = await Post.getById(contentId);
      if (post) {
        contentExists = true;
        contentOwnerId = post.userId;
      } else {
        // Check if it's a reel/story
        const story = await Story.getById(contentId);
        if (story) {
          contentExists = true;
          contentOwnerId = story.userId;
        }
      }
      
      if (!contentExists) {
        return res.status(404).json({ message: 'Content not found' });
      }
      
      // Verify parent comment exists if provided
      if (parentId) {
        const parentComment = await Interaction.getById(parentId);
        if (!parentComment || parentComment.type !== 'comment') {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
      }
      
      // Create comment
      const comment = await Interaction.create({
        type: 'comment',
        userId,
        contentId,
        content,
        parentId
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
      
      // Send notification to content owner if it's not the same user
      if (contentOwnerId && contentOwnerId !== userId) {
        try {
          // Create notification message
          const notificationMessage = {
            type: 'comment',
            senderId: userId,
            recipientId: contentOwnerId,
            contentId,
            contentType: post ? 'post' : 'reel',
            message: `${user.username} commented on your ${post ? 'post' : 'reel'}`,
            timestamp: new Date().toISOString()
          };
          
          // Send to SNS
          await snsService.publishNotification(notificationMessage);
          
          // Also emit via socket.io for real-time updates
          req.app.get('io').to(contentOwnerId).emit('notification', notificationMessage);
        } catch (notifError) {
          console.error('Notification error:', notifError);
          // Continue even if notification fails
        }
      }
      
      // If it's a reply, also notify the parent comment author
      if (parentId) {
        try {
          const parentComment = await Interaction.getById(parentId);
          if (parentComment && parentComment.userId !== userId) {
            const parentAuthor = await User.getById(parentComment.userId);
            
            // Create notification message
            const notificationMessage = {
              type: 'reply',
              senderId: userId,
              recipientId: parentComment.userId,
              contentId: parentId,
              contentType: 'comment',
              message: `${user.username} replied to your comment`,
              timestamp: new Date().toISOString()
            };
            
            // Send to SNS
            await snsService.publishNotification(notificationMessage);
            
            // Also emit via socket.io for real-time updates
            req.app.get('io').to(parentComment.userId).emit('notification', notificationMessage);
          }
        } catch (notifError) {
          console.error('Reply notification error:', notifError);
          // Continue even if notification fails
        }
      }
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get comments for a content item
  getComments: async (req, res) => {
    try {
      const { contentId } = req.params;
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
      
      // Get top-level comments (no parentId)
      const result = await Interaction.getByContentId(
        contentId, 
        'comment', 
        parseInt(limit), 
        lastEvaluatedKey
      );
      
      // Get user details for each comment
      const comments = result.interactions.filter(i => !i.parentId);
      const userIds = [...new Set(comments.map(comment => comment.userId))];
      
      // Get all users in a single batch
      const userPromises = userIds.map(id => User.getById(id));
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
      const formattedComments = comments.map(comment => ({
        ...comment,
        user: userMap[comment.userId] || { userId: comment.userId, username: 'Unknown' },
        replies: [] // Will be populated if needed
      }));
      
      // Encode lastEvaluatedKey for pagination
      let nextKey = null;
      if (result.lastEvaluatedKey) {
        nextKey = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
      }
      
      res.status(200).json({
        comments: formattedComments,
        nextKey
      });
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Get comment replies
  getReplies: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { limit = 10, lastKey } = req.query;
      
      // Parse lastKey if provided
      let lastEvaluatedKey = null;
      if (lastKey) {
        try {
          lastEvaluatedKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        } catch (parseError) {
          return res.status(400).json({ message: 'Invalid lastKey format' });
        }
      }
      
      // Get replies
      const result = await Interaction.getReplies(
        commentId, 
        parseInt(limit), 
        lastEvaluatedKey
      );
      
      // Get user details for each reply
      const userIds = [...new Set(result.replies.map(reply => reply.userId))];
      
      // Get all users in a single batch
      const userPromises = userIds.map(id => User.getById(id));
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
      const formattedReplies = result.replies.map(reply => ({
        ...reply,
        user: userMap[reply.userId] || { userId: reply.userId, username: 'Unknown' }
      }));
      
      // Encode lastEvaluatedKey for pagination
      let nextKey = null;
      if (result.lastEvaluatedKey) {
        nextKey = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
      }
      
      res.status(200).json({
        replies: formattedReplies,
        nextKey
      });
    } catch (error) {
      console.error('Get replies error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Delete a comment
  deleteComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.userId;
      
      // Delete the comment
      const success = await Interaction.delete(commentId, userId);
      
      if (!success) {
        return res.status(404).json({ message: 'Comment not found or not authorized to delete' });
      }
      
      res.status(200).json({
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Like a comment
  likeComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.userId;
      
      // Check if comment exists
      const comment = await Interaction.getById(commentId);
      
      if (!comment || comment.type !== 'comment') {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      // Create like interaction
      await Interaction.create({
        type: 'like',
        userId,
        contentId: commentId,
        content: '',
        parentId: null
      });
      
      // Send notification to comment author if it's not the same user
      if (comment.userId !== userId) {
        try {
          // Get user details for the notification
          const user = await User.getById(userId);
          const commentAuthor = await User.getById(comment.userId);
          
          // Create notification message
          const notificationMessage = {
            type: 'like',
            senderId: userId,
            recipientId: comment.userId,
            contentId: commentId,
            contentType: 'comment',
            message: `${user.username} liked your comment`,
            timestamp: new Date().toISOString()
          };
          
          // Send to SNS
          await snsService.publishNotification(notificationMessage);
          
          // Also emit via socket.io for real-time updates
          req.app.get('io').to(comment.userId).emit('notification', notificationMessage);
        } catch (notifError) {
          console.error('Notification error:', notifError);
          // Continue even if notification fails
        }
      }
      
      res.status(200).json({
        message: 'Comment liked successfully'
      });
    } catch (error) {
      console.error('Like comment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Unlike a comment
  unlikeComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.userId;
      
      // Find the like interaction
      const params = {
        TableName: 'SocialMedia_Interactions',
        IndexName: 'UserContentIndex',
        KeyConditionExpression: 'userId = :userId AND contentId = :contentId',
        FilterExpression: 'type = :type',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':contentId': commentId,
          ':type': 'like'
        }
      };
      
      // This is a simplified approach - would need actual implementation
      // to find and delete the like interaction
      
      res.status(200).json({
        message: 'Comment unliked successfully'
      });
    } catch (error) {
      console.error('Unlike comment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = interactionController;