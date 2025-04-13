// Main server file for social media backend
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const reelRoutes = require('./routes/reels');
const storyRoutes = require('./routes/stories');
const interactionRoutes = require('./routes/interactions');
const { healthCheck, deepHealthCheck } = require('./monitoring/healthcheck');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet()); // Set security headers
app.use(cors()); // Enable CORS for all routes
app.use(morgan('dev')); // Logging
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/interactions', interactionRoutes);

// Health check route
app.get('/health', healthCheck);

app.get('/healthdeep', deepHealthCheck);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Socket.io connection handlers for real-time features
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Join user's personal room for notifications
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined personal room`);
  });
  
  // Handle real-time notifications for likes, comments, etc.
  socket.on('notification', (data) => {
    // Send notification to recipient
    io.to(data.recipientId).emit('notification', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, server, io };