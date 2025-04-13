const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Configure AWS
AWS.config.update({
  region: config.aws.region || 'us-east-1',
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});

// Initialize S3 client
const s3 = new AWS.S3();

// S3 bucket names
const BUCKETS = {
  IMAGES: config.aws.s3.imagesBucket || 'social-media-images',
  VIDEOS: config.aws.s3.videosBucket || 'social-media-videos',
  PROFILE_PICTURES: config.aws.s3.profilePicturesBucket || 'social-media-profile-pictures'
};

// Service for handling S3 operations
const s3Service = {
  // Direct upload file to S3 from buffer or file path
  uploadFile: async (file, options = {}) => {
    try {
      // Default options
      const {
        bucket = BUCKETS.IMAGES,
        folder = 'uploads',
        userId = 'anonymous',
        contentType = null,
        isPublic = true
      } = options;
      
      // Determine file content
      let fileContent;
      let fileContentType = contentType;
      
      if (Buffer.isBuffer(file)) {
        // If file is already a buffer
        fileContent = file;
      } else if (typeof file === 'string' && fs.existsSync(file)) {
        // If file is a path to a file
        fileContent = fs.readFileSync(file);
        
        if (!fileContentType) {
          // Try to determine content type from file extension
          const ext = path.extname(file).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.wmv': 'video/x-ms-wmv'
          };
          fileContentType = mimeTypes[ext] || 'application/octet-stream';
        }
      } else if (file.buffer && file.originalname) {
        // If file is a multer file object
        fileContent = file.buffer;
        fileContentType = fileContentType || file.mimetype;
      } else {
        throw new Error('Invalid file format. Expected Buffer, file path, or Multer file object');
      }
      
      // Generate a unique filename
      const filename = typeof file === 'string' 
        ? path.basename(file) 
        : (file.originalname || 'file');
      
      const fileExtension = path.extname(filename);
      const uniqueFilename = `${folder}/${userId}/${uuidv4()}${fileExtension}`;
      
      // Define upload parameters
      const params = {
        Bucket: bucket,
        Key: uniqueFilename,
        Body: fileContent,
        ContentType: fileContentType,
        ACL: isPublic ? 'public-read' : 'private'
      };
      
      // Upload to S3
      const result = await s3.upload(params).promise();
      
      return {
        key: result.Key,
        location: result.Location,
        bucket: result.Bucket,
        contentType: fileContentType
      };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw error;
    }
  },
  
  // Upload multiple files to S3
  uploadMultipleFiles: async (files, options = {}) => {
    try {
      if (!Array.isArray(files) || files.length === 0) {
        return [];
      }
      
      // Upload all files in parallel
      const uploadPromises = files.map(file => s3Service.uploadFile(file, options));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files to S3:', error);
      throw error;
    }
  },
  
  // Delete a file from S3
  deleteFile: async (key, bucket) => {
    try {
      const params = {
        Bucket: bucket,
        Key: key
      };
      
      await s3.deleteObject(params).promise();
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw error;
    }
  },
  
  // Delete multiple files from S3
  deleteMultipleFiles: async (keys, bucket) => {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return { success: true, message: 'No files to delete' };
      }
      
      // S3 requires a specific format for batch deletes
      const objects = keys.map(key => ({ Key: key }));
      
      const params = {
        Bucket: bucket,
        Delete: {
          Objects: objects,
          Quiet: false
        }
      };
      
      const result = await s3.deleteObjects(params).promise();
      
      return {
        success: true,
        deleted: result.Deleted,
        errors: result.Errors
      };
    } catch (error) {
      console.error('Error deleting multiple files from S3:', error);
      throw error;
    }
  },
  
  // Get a signed URL for temporary access to a private file
  getSignedUrl: (key, bucket, expiresInSeconds = 3600) => {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        Expires: expiresInSeconds
      };
      
      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  },
  
  // Check if a file exists in S3
  fileExists: async (key, bucket) => {
    try {
      const params = {
        Bucket: bucket,
        Key: key
      };
      
      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  },
  
  // Get S3 object metadata
  getMetadata: async (key, bucket) => {
    try {
      const params = {
        Bucket: bucket,
        Key: key
      };
      
      const result = await s3.headObject(params).promise();
      return result;
    } catch (error) {
      console.error('Error getting S3 object metadata:', error);
      throw error;
    }
  },
  
  // Copy file within S3
  copyFile: async (sourceKey, sourceBucket, destinationKey, destinationBucket, isPublic = true) => {
    try {
      const params = {
        Bucket: destinationBucket,
        CopySource: `/${sourceBucket}/${encodeURIComponent(sourceKey)}`,
        Key: destinationKey,
        ACL: isPublic ? 'public-read' : 'private'
      };
      
      const result = await s3.copyObject(params).promise();
      
      return {
        key: destinationKey,
        bucket: destinationBucket,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error copying file in S3:', error);
      throw error;
    }
  }
};

// Export the S3 service and bucket names
module.exports = {
  s3Service,
  BUCKETS
};
