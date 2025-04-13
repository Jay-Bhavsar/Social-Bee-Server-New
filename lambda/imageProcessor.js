// lambda/imageProcessor.js
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        // Process each record (S3 upload event)
        for (const record of event.Records) {
            // Extract bucket and key from the event
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
            
            // Skip if not an image
            if (!key.match(/\.(jpg|jpeg|png|gif)$/i)) {
                continue;
            }
            
            // Download the original image from S3
            const originalImage = await s3.getObject({
                Bucket: bucket,
                Key: key
            }).promise();
            
            // Generate thumbnail using sharp
            const thumbnail = await sharp(originalImage.Body)
                .resize(300, 300, { fit: 'inside' })
                .toBuffer();
            
            // Calculate destination thumbnail path
            const thumbnailKey = key.replace(/^(.+)\.(.+)$/, '$1_thumbnail.$2');
            
            // Upload thumbnail to S3
            await s3.putObject({
                Bucket: bucket,
                Key: thumbnailKey,
                Body: thumbnail,
                ContentType: originalImage.ContentType,
                ACL: 'public-read'
            }).promise();
            
            // Determine if this is a profile picture or post image
            let tableName = '';
            let updateField = '';
            
            if (key.includes('/profiles/')) {
                // This is a profile picture
                tableName = 'SocialMedia_Users';
                updateField = 'profilePicture';
                
                // Extract user ID from the path
                const userIdMatch = key.match(/\/profiles\/([^\/]+)\//);
                if (userIdMatch && userIdMatch[1]) {
                    const userId = userIdMatch[1];
                    
                    // Update the user record with thumbnail URL
                    await dynamoDB.update({
                        TableName: tableName,
                        Key: { userId },
                        UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl',
                        ExpressionAttributeValues: {
                            ':thumbnailUrl': `https://${bucket}.s3.amazonaws.com/${thumbnailKey}`
                        }
                    }).promise();
                }
            } else if (key.includes('/posts/')) {
                // For post images, we could add logic to update post metadata
                // or generate additional transformations if needed
            }
            
            console.log(`Successfully processed ${key} and created thumbnail at ${thumbnailKey}`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Image processing completed successfully' })
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
};