
// utils/encryption.js - Data encryption utilities
const crypto = require('crypto');

// Encrypt sensitive data
const encryptData = (data, encryptionKey) => {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV with encrypted data for decryption
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

// Decrypt sensitive data
const decryptData = (encryptedData, encryptionKey) => {
  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

module.exports = {
  encryptData,
  decryptData
};
