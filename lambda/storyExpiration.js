// lambda/storyExpiration.js
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

exports.handler = async (event) => {
    try {
        // This function runs on a schedule to clean up expired stories
        // even though DynamoDB TTL should handle most of this automatically
        
        // Get current timestamp
        const now = Math.floor(Date.now() / 1000);
        
        // Scan for expired stories that haven't been removed by TTL yet
        const params = {
            TableName: 'SocialMedia_Stories',
            FilterExpression: 'expiryTime < :now AND contentType = :contentType',
            ExpressionAttributeValues: {
                ':now': now,
                ':contentType': 'story'
            }
        };
        
        const result = await dynamoDB.scan(params).promise();
        
        console.log(`Found ${result.Items.length} expired stories to clean up`);
        
        // Process each expired story
        for (const story of result.Items) {
            // Delete associated media from S3
            if (story.mediaUrl) {
                // Extract bucket and key from S3 URL
                const urlMatch = story.mediaUrl.match(/https:\/\/([^\/]+)\/(.+)/);
                if (urlMatch) {
                    const bucket = urlMatch[1].split('.')[0];
                    const key = urlMatch[2];
                    
                    try {
                        await s3.deleteObject({
                            Bucket: bucket,
                            Key: key
                        }).promise();
                        
                        console.log(`Deleted expired story media: ${key}`);
                    } catch (deleteError) {
                        console.error(`Error deleting story media ${key}:`, deleteError);
                    }
                }
            }
            
            // Delete the story from DynamoDB (backup in case TTL didn't work)
            try {
                await dynamoDB.delete({
                    TableName: 'SocialMedia_Stories',
                    Key: { contentId: story.contentId }
                }).promise();
                
                console.log(`Deleted expired story: ${story.contentId}`);
            } catch (deleteError) {
                console.error(`Error deleting story ${story.contentId}:`, deleteError);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Story cleanup completed successfully',
                processedCount: result.Items.length
            })
        };
    } catch (error) {
        console.error('Error in story expiration handler:', error);
        throw error;
    }
};