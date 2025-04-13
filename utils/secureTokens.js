// utils/secureTokens.js - Secure token handling
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate secure random token
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate JWT with enhanced security
const generateSecureJWT = (payload, secret, options = {}) => {
  // Set secure defaults if not provided
  const secureOptions = {
    expiresIn: options.expiresIn || '1h',
    issuer: options.issuer || process.env.JWT_ISSUER || 'social-media-app',
    audience: options.audience || process.env.JWT_AUDIENCE || 'social-media-users',
    subject: payload.userId || payload.sub,
    jwtid: crypto.randomBytes(16).toString('hex'), // Unique token ID
    ...options
  };
  
  return jwt.sign(payload, secret, secureOptions);
};

// Verify JWT with enhanced security
const verifySecureJWT = (token, secret, options = {}) => {
  // Set secure defaults if not provided
  const secureOptions = {
    issuer: options.issuer || process.env.JWT_ISSUER || 'social-media-app',
    audience: options.audience || process.env.JWT_AUDIENCE || 'social-media-users',
    ...options
  };
  
  return jwt.verify(token, secret, secureOptions);
};

module.exports = {
  generateSecureToken,
  generateSecureJWT,
  verifySecureJWT
};
