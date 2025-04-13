const multer = require('multer');
const { s3Service, BUCKETS } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Define allowed file types
const ALLOWED_IMAGE_TYPES = config.media.allowedImageTypes || [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/gif'
];

const ALLOWED_VIDEO_TYPES = config.media.allowedVideoTypes || [
  'video/mp4', 
  'video/quicktime', 
  'video/x-msvideo', 
  'video/x-ms-wmv'
];

// Maximum file sizes (in bytes)
const MAX_IMAGE_SIZE = config.media.maxImageSize || 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = config.media.maxVideoSize || 100 * 1024 * 1024; // 100MB
const MAX_PROFILE_SIZE = config.media.maxProfilePictureSize || 2 * 1024 * 1024; // 2MB

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// File filter function
const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Configure multer storage - we'll use disk storage temporarily, then upload to S3
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// S3 upload handler (after multer processes the file)
const uploadToS3 = (folder, bucket) => {
  return async (req, res, next) => {
    try {
      // No file to upload
      console.log(req.file,"+++++++++++++++")
      if (!req.file && (!req.files || req.files.length === 0)) {
        return next();
      }
      
      const userId = req.user?.userId || 'anonymous';
      
      // Handle single file upload
      if (req.file) {
        const result = await s3Service.uploadFile(req.file.path, {
          bucket,
          folder,
          userId,
          contentType: req.file.mimetype,
          isPublic: true
        });
        
        // Add S3 details to the request
        req.file.s3 = result;
        req.file.location = result.location;
        
        // Delete the temporary file
        fs.unlinkSync(req.file.path);
      }
      
      // Handle multiple file uploads
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(async (file) => {
          const result = await s3Service.uploadFile(file.path, {
            bucket,
            folder,
            userId,
            contentType: file.mimetype,
            isPublic: true
          });
          
          // Add S3 details to the file object
          file.s3 = result;
          file.location = result.location;
          
          // Delete the temporary file
          fs.unlinkSync(file.path);
          
          return file;
        });
        
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
      }
      
      next();
    } catch (error) {
      // Clean up temporary files if an error occurs
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
        });
      }
      
      next(error);
    }
  };
};

// Create the upload middleware functions
const uploadMiddleware = {
  // For profile pictures
  profilePicture: [
    multer({
      storage,
      limits: {
        fileSize: MAX_PROFILE_SIZE
      },
      fileFilter: fileFilter(ALLOWED_IMAGE_TYPES)
    }).single('profilePicture'),
    uploadToS3('profiles', BUCKETS.PROFILE_PICTURES)
  ],
  
  // For post images
  postImages: [
    multer({
      storage,
      // limits: {
      //   fileSize: MAX_IMAGE_SIZE
      // },
      fileFilter: fileFilter(ALLOWED_IMAGE_TYPES)
    }).array('images', 10), // Allow up to 10 images per post
    uploadToS3('posts', BUCKETS.IMAGES)
  ],
  
  // For post videos
  postVideo: [
    multer({
      storage,
      limits: {
        fileSize: MAX_VIDEO_SIZE
      },
      fileFilter: fileFilter(ALLOWED_VIDEO_TYPES)
    }).single('video'),
    uploadToS3('posts', BUCKETS.VIDEOS)
  ],
  
  // For story images
  storyImage: [
    multer({
      storage,
      limits: {
        fileSize: MAX_IMAGE_SIZE
      },
      fileFilter: fileFilter(ALLOWED_IMAGE_TYPES)
    }).single('image'),
    uploadToS3('stories', BUCKETS.IMAGES)
  ],
  
  // For story videos
  storyVideo: [
    multer({
      storage,
      limits: {
        fileSize: MAX_VIDEO_SIZE
      },
      fileFilter: fileFilter(ALLOWED_VIDEO_TYPES)
    }).single('video'),
    uploadToS3('stories', BUCKETS.VIDEOS)
  ],
  
  // For reel videos
  reelVideo: [
    multer({
      storage,
      limits: {
        fileSize: MAX_VIDEO_SIZE
      },
      fileFilter: fileFilter(ALLOWED_VIDEO_TYPES)
    }).single('video'),
    uploadToS3('reels', BUCKETS.VIDEOS)
  ],
  
  // Error handling middleware
  handleUploadError: (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File is too large',
          error: {
            code: 'LIMIT_FILE_SIZE',
            field: err.field
          }
        });
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected field',
          error: {
            code: 'LIMIT_UNEXPECTED_FILE',
            field: err.field
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        error: {
          code: err.code
        }
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    next();
  },
  
  // Helper to get file URLs
  getFileUrl: (req) => {
    if (!req.file) return null;
    return req.file.location;
  },
  
  // Helper to get multiple file URLs
  getFileUrls: (req) => {
    if (!req.files || req.files.length === 0) return [];
    return req.files.map(file => file.location);
  }
};

module.exports = uploadMiddleware;
