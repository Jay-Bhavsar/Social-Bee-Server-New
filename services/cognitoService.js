// services/cognitoService.js
const { cognito } = require('../config/aws');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const dotenv = require('dotenv');
const crypto = require("crypto");


// Load environment variables
dotenv.config();

// Cognito user pool and client IDs
const COGNITO = {
  USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  CLIENT_ID: process.env.COGNITO_CLIENT_ID
};

// Cognito service for authentication
const cognitoService = {
  // Register new user
  signUp: async (username, email, password) => {
    try {
      const secretHash = generateSecretHash(username);
      
      const params = {
        ClientId: COGNITO.CLIENT_ID,
        Username: username,
        Password: password,
        SecretHash: secretHash,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
          // Removed the custom:username attribute for now
        ]
      };
      
      const result = await cognito.signUp(params).promise();
      return result;
    } catch (error) {
      console.error('Cognito signup error:', error);
      throw error;
    }
  },
  
  // Confirm registration
  confirmSignUp: async (username, confirmationCode) => {
    try {
      const secretHash = generateSecretHash(username);

      const params = {
        ClientId: COGNITO.CLIENT_ID,
        Username: username,
        SecretHash: secretHash,
        ConfirmationCode: confirmationCode
      };
      
      const result = await cognito.confirmSignUp(params).promise();
      return result;
    } catch (error) {
      console.error('Cognito confirm signup error:', error);
      throw error;
    }
  },
  
  // Sign in user
  signIn: async (email, password) => {
    try {
      // First, implement the generateSecretHash function if you haven't already
      const generateSecretHash = (username) => {
        const crypto = require('crypto');
        return crypto
          .createHmac("SHA256", process.env.COGNITO_CLIENT_SECRET)
          .update(username + process.env.COGNITO_CLIENT_ID)
          .digest("base64");
      };
      
      const secretHash = generateSecretHash(email);
      
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO.CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: secretHash
        }
      };
      
      const result = await cognito.initiateAuth(params).promise();
      return {
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        idToken: result.AuthenticationResult.IdToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      };
    } catch (error) {
      console.error('Cognito signin error:', error);
      throw error;
    }
  },

  
  // Refresh tokens
  refreshToken: async (refreshToken) => {
    try {
      const params = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: COGNITO.CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      };
      
      const result = await cognito.initiateAuth(params).promise();
      return {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      };
    } catch (error) {
      console.error('Cognito refresh token error:', error);
      throw error;
    }
  },
  
  // Verify JWT token
  verifyToken: async (token) => {
    try {
      // For simplicity, we'll use jsonwebtoken to verify the token
      // In production, you should validate against Cognito's JWKs
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  },
  
  // Forgot password
  forgotPassword: async (email) => {
    try {
      const params = {
        ClientId: COGNITO.CLIENT_ID,
        Username: email
      };
      
      const result = await cognito.forgotPassword(params).promise();
      return result;
    } catch (error) {
      console.error('Cognito forgot password error:', error);
      throw error;
    }
  },
  
  // Confirm forgot password
  confirmForgotPassword: async (email, confirmationCode, newPassword) => {
    try {
      const params = {
        ClientId: COGNITO.CLIENT_ID,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword
      };
      
      const result = await cognito.confirmForgotPassword(params).promise();
      return result;
    } catch (error) {
      console.error('Cognito confirm forgot password error:', error);
      throw error;
    }
  }
};

const CLIENT_ID = "619bv5md78j5c0sh5p661rbbt5";
const CLIENT_SECRET = "g51mrlkk9n79ob4baudiv62hnaucl4tcmlt9oc759c0fn1r58q9";


function generateSecretHash(username) {
  return crypto
    .createHmac("SHA256", process.env.COGNITO_CLIENT_SECRET)
    .update(username + process.env.COGNITO_CLIENT_ID)
    .digest("base64");
}

module.exports = {
  cognitoService,
  COGNITO
};