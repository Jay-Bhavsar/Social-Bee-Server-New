// middleware/security.js - Additional security headers and protections
const helmet = require('helmet');
const csrf = require('csurf');
const { v4: uuidv4 } = require('uuid');

// Configure security middleware
const configureSecurityMiddleware = (app) => {
  // Set security headers with Helmet
  app.use(helmet());
  
  // Configure Content Security Policy
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.cloudfront.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "*.cloudfront.net"],
      imgSrc: ["'self'", "data:", "*.cloudfront.net", "*.amazonaws.com"],
      connectSrc: ["'self'", "*.amazonaws.com", "*.execute-api.*.amazonaws.com"],
      fontSrc: ["'self'", "*.cloudfront.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "*.cloudfront.net", "*.amazonaws.com"],
      frameSrc: ["'none'"]
    }
  }));
  
  // Add CSRF protection for non-GET requests (for web app)
  if (process.env.ENABLE_CSRF === 'true') {
    app.use(csrf({ cookie: true }));
    
    // CSRF error handler
    app.use((err, req, res, next) => {
      if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
          message: 'Invalid CSRF token'
        });
      }
      next(err);
    });
    
    // Provide CSRF token to client
    app.get('/api/csrf-token', (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }
  
  // Add request ID to each request for tracing
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });
  
  // Add timestamp to each request
  app.use((req, res, next) => {
    req.requestTimestamp = Date.now();
    next();
  });
};

module.exports = configureSecurityMiddleware;

