// lambda/contentModerator.js
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const comprehend = new AWS.Comprehend();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
    try {
        // Process each record
        for (const record of event.Records) {
            // Handle different event types
            if (record.eventSource === 'aws:s3') {
                // S3 event - moderate image/video
                await moderateMedia(record);
            } else if (record.eventSource === 'aws:dynamodb') {
                if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
                    // DynamoDB event - moderate text content
                    if (record.dynamodb.NewImage.content) {
                        await moderateText(record);
                    }
                }
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Content moderation completed successfully' })
        };
    } catch (error) {
        console.error('Error in content moderation:', error);
        throw error;
    }
};

// Function to moderate image/video content
async function moderateMedia(record) {
    // Extract bucket and key from S3 event
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Skip if not an image/video
    if (!key.match(/\.(jpg|jpeg|png|gif|mp4|mov)$/i)) {
        return;
    }
    
    // Call Rekognition to moderate the content
    const params = {
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
        },
        MinConfidence: 60
    };
    
    // Detect moderation labels
    const result = await rekognition.detectModerationLabels(params).promise();
    
    // Check if any inappropriate content was detected
    const inappropriateLabels = result.ModerationLabels.filter(label => 
        label.Confidence >= 70 && 
        ['Explicit Nudity', 'Violence', 'Visually Disturbing', 'Hate Symbols'].includes(label.Name)
    );
    
    if (inappropriateLabels.length > 0) {
        console.log(`Inappropriate content detected in ${key}:`, inappropriateLabels);
        
        // Determine content type and ID based on S3 key pattern
        let contentType = '';
        let contentId = '';
        
        if (key.includes('/posts/')) {
            contentType = 'post';
            // Extract post ID from key
            const postIdMatch = key.match(/\/posts\/([^\/]+)\//);
            if (postIdMatch && postIdMatch[1]) {
                contentId = postIdMatch[1];
            }
        } else if (key.includes('/reels/')) {
            contentType = 'reel';
            // Extract reel ID from key
            const reelIdMatch = key.match(/\/reels\/([^\/]+)\//);
            if (reelIdMatch && reelIdMatch[1]) {
                contentId = reelIdMatch[1];
            }
        }
        
        if (contentId && contentType) {
            // Flag the content for review
            await flagContentForReview(contentId, contentType, 'image', inappropriateLabels);
        }
    }
}

// Function to moderate text content
async function moderateText(record) {
    // Extract content and ID from DynamoDB event
    const content = record.dynamodb.NewImage.content.S;
    const contentId = record.dynamodb.NewImage.contentId ? record.dynamodb.NewImage.contentId.S : null;
    const contentType = determineContentType(record);
    
    if (!content || !contentId || !contentType) {
        return;
    }
    
    // Call Comprehend to detect sentiment and key phrases
    const sentimentResult = await comprehend.detectSentiment({
        Text: content,
        LanguageCode: 'en'
    }).promise();
    
    // Check for toxic content
    if (sentimentResult.SentimentScore.Negative > 0.8) {
        console.log(`Potentially toxic content detected in ${contentType} ${contentId}`);
        
        // Flag the content for review
        await flagContentForReview(contentId, contentType, 'text', {
            sentiment: sentimentResult.Sentiment,
            score: sentimentResult.SentimentScore.Negative
        });
    }
}

// Helper function to determine content type from DynamoDB record
function determineContentType(record) {
    const tableName = record.eventSourceARN.split('/')[1];
    
    if (tableName.includes('Posts')) {
        return 'post';
    } else if (tableName.includes('Interactions')) {
        return record.dynamodb.NewImage.type?.S === 'comment' ? 'comment' : 'interaction';
    } else if (tableName.includes('Stories')) {
        return record.dynamodb.NewImage.contentType?.S === 'story' ? 'story' : 'reel';
    }
    
    return null;
}

// Function to flag content for review
async function flagContentForReview(contentId, contentType, moderationType, moderationData) {
    // Store moderation record in DynamoDB
    const moderationRecord = {
        id: `${contentType}_${contentId}`,
        contentId,
        contentType,
        moderationType,
        moderationData,
        status: 'flagged',
        timestamp: new Date().toISOString()
    };
    
    await dynamoDB.put({
        TableName: 'SocialMedia_ContentModeration',
        Item: moderationRecord
    }).promise();
    
    // Notify admins via SNS
    await sns.publish({
        TopicArn: process.env.ADMIN_NOTIFICATION_TOPIC,
        Subject: 'Content Flagged for Review',
        Message: JSON.stringify({
            contentId,
            contentType,
            moderationType,
            moderationData
        })
    }).promise();
}

