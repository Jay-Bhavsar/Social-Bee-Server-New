// services/elasticsearchService.js
const { es } = require('../config/aws');

// Elasticsearch domain
const ES_DOMAIN = process.env.ES_DOMAIN || 'social-media-search';

// Elasticsearch service for search functionality
const elasticsearchService = {
  // Search for users
  searchUsers: async (query, limit = 10) => {
    try {
      const params = {
        DomainName: ES_DOMAIN,
        Path: '/users/_search',
        Body: JSON.stringify({
          query: {
            multi_match: {
              query: query,
              fields: ['username', 'fullName', 'bio']
            }
          },
          size: limit
        })
      };
      
      const result = await es.esHttpPost(params).promise();
      const response = JSON.parse(result.Body.toString());
      
      return response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }));
    } catch (error) {
      console.error('Elasticsearch search users error:', error);
      throw error;
    }
  },
  
  // Search for posts
  searchPosts: async (query, limit = 20) => {
    try {
      const params = {
        DomainName: ES_DOMAIN,
        Path: '/posts/_search',
        Body: JSON.stringify({
          query: {
            multi_match: {
              query: query,
              fields: ['content', 'tags']
            }
          },
          size: limit
        })
      };
      
      const result = await es.esHttpPost(params).promise();
      const response = JSON.parse(result.Body.toString());
      
      return response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }));
    } catch (error) {
      console.error('Elasticsearch search posts error:', error);
      throw error;
    }
  },
  
  // Index new document
  indexDocument: async (index, id, document) => {
    try {
      const params = {
        DomainName: ES_DOMAIN,
        Path: `/${index}/_doc/${id}`,
        Body: JSON.stringify(document)
      };
      
      const result = await es.esHttpPut(params).promise();
      return JSON.parse(result.Body.toString());
    } catch (error) {
      console.error('Elasticsearch index document error:', error);
      throw error;
    }
  },
  
  // Delete document
  deleteDocument: async (index, id) => {
    try {
      const params = {
        DomainName: ES_DOMAIN,
        Path: `/${index}/_doc/${id}`
      };
      
      const result = await es.esHttpDelete(params).promise();
      return JSON.parse(result.Body.toString());
    } catch (error) {
      console.error('Elasticsearch delete document error:', error);
      throw error;
    }
  }
};

module.exports = {
  elasticsearchService,
  ES_DOMAIN
};