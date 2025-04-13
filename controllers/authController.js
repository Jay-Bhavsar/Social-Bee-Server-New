// controllers/authController.js
const User = require('../models/User');
const { cognitoService } = require('../services/cognitoService');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { snsService } = require('../services/snsService');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const authController = {
  // Register a new user
  register: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.getByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      
      const existingUsername = await User.getByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      
      // Register user with Cognito
      try {
        const cognitoResult = await cognitoService.signUp(username, email, password);
        
        // Create user in DynamoDB
        const user = await User.create({
          userId: cognitoResult.UserSub,
          username,
          email,
          password // Will be hashed in the model
        });
        
        // Generate token
        const token = generateToken(user.userId);
        
        // Return success response
        res.status(201).json({
          message: 'User registered successfully',
          user: {
            userId: user.userId,
            username: user.username,
            email: user.email
          },
          token
        });
      } catch (cognitoError) {
        console.error('Cognito registration error:', cognitoError);
        return res.status(400).json({ message: cognitoError.message });
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Confirm user registration
  confirmRegistration: async (req, res) => {
    try {
      const { username, confirmationCode } = req.body;
      
      // Confirm with Cognito
      try {
        await cognitoService.confirmSignUp(username, confirmationCode);
        
        res.status(200).json({ message: 'User confirmed successfully' });
      } catch (cognitoError) {
        console.error('Cognito confirmation error:', cognitoError);
        return res.status(400).json({ message: cognitoError.message });
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Login user
  login: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { email, password } = req.body;
      
      // Authenticate with Cognito
      try {
        const authResult = await cognitoService.signIn(email, password);
        
        // Get user from DynamoDB
        const user = await User.getByEmail(email);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Generate token
        const token = generateToken(user.userId);
        
        // Return success response
        res.status(200).json({
          message: 'Login successful',
          user: {
            userId: user.userId,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture
          },
          token,
          cognitoTokens: authResult
        });
      } catch (authError) {
        console.error('Authentication error:', authError);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
      }
      
      try {
        // Refresh tokens with Cognito
        const tokens = await cognitoService.refreshToken(refreshToken);
        
        res.status(200).json({
          message: 'Tokens refreshed successfully',
          ...tokens
        });
      } catch (tokenError) {
        console.error('Token refresh error:', tokenError);
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Forgot password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      
      // Check if user exists
      const user = await User.getByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      try {
        // Request password reset from Cognito
        await cognitoService.forgotPassword(email);
        
        res.status(200).json({ 
          message: 'Password reset code sent to your email' 
        });
      } catch (cognitoError) {
        console.error('Cognito forgot password error:', cognitoError);
        return res.status(400).json({ message: cognitoError.message });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Reset password with confirmation code
  resetPassword: async (req, res) => {
    try {
      const { email, confirmationCode, newPassword } = req.body;
      
      try {
        // Reset password in Cognito
        await cognitoService.confirmForgotPassword(
          email, 
          confirmationCode, 
          newPassword
        );
        
        // Get user from DynamoDB
        const user = await User.getByEmail(email);
        if (user) {
          // Update password in DynamoDB as well
          await User.changePassword(user.userId, newPassword);
        }
        
        res.status(200).json({ message: 'Password reset successful' });
      } catch (resetError) {
        console.error('Password reset error:', resetError);
        return res.status(400).json({ message: resetError.message });
      }
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  // Change password (when logged in)
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      
      // Verify current password
      const isPasswordValid = await User.verifyPassword(userId, currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Change password in DynamoDB
      await User.changePassword(userId, newPassword);
      
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = authController;