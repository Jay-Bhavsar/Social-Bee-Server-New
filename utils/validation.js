
// utils/validation.js - Enhanced input validation
const { validationResult } = require('express-validator');
const xss = require('xss');

// Custom validation middleware
const validate = validations => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    res.status(400).json({
      message: 'Validation error',
      errors: errors.array()
    });
  };
};

// Sanitize input to prevent XSS
const sanitizeInput = (req, res, next) => {
  // Sanitize body parameters
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  next();
};

module.exports = {
  validate,
  sanitizeInput
};