// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cognitoService } = require('../services/cognitoService');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.getById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  authenticateToken
};