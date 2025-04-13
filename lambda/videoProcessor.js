// lambda/videoProcessor.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const mediaconvert = new AWS.MediaConvert({ endpoint: process.env.MEDIA_CONVERT_ENDPOINT });

exports.handler = async (event) => {
    try {
        // Process each record (S3 upload event)
        for (const record of event.Records) {
            // Extract bucket and key from the event
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
            
            // Skip if not a video
            if (!key.match(/\.(mp4|mov|avi|wmv)$/i)) {
                continue;
            }
            
            // Generate a thumbnail from the video
            // In a real implementation, you would use MediaConvert to extract a frame
            
            // Set up MediaConvert job parameters
            const params = {
                Role: process.env.MEDIA_CONVERT_ROLE,
                Settings: {
                    Inputs: [
                        {
                            FileInput: `s3://${bucket}/${key}`
                        }
                    ],
                    OutputGroups: [
                        {
                            Name: 'Thumbnail',
                            OutputGroupSettings: {
                                Type: 'FILE_GROUP_SETTINGS',
                                FileGroupSettings: {
                                    Destination: `s3://${process.env.OUTPUT_BUCKET}/thumbnails/`
                                }
                            },
                            Outputs: [
                                {
                                    NameModifier: '_thumbnail',
                                    ContainerSettings: {
                                        Container: 'RAW'
                                    },
                                    VideoDescription: {
                                        CodecSettings: {
                                            Codec: 'FRAME_CAPTURE',
                                            FrameCaptureSettings: {
                                                FramerateNumerator: 1,
                                                FramerateDenominator: 1,
                                                MaxCaptures: 1,
                                                Quality: 80
                                            }
                                        }
                                    }
                                }
                            ]
                        },
                        {
                            Name: 'MP4_Output',
                            OutputGroupSettings: {
                                Type: 'FILE_GROUP_SETTINGS',
                                FileGroupSettings: {
                                    Destination: `s3://${process.env.OUTPUT_BUCKET}/processed/`
                                }
                            },
                            Outputs: [
                                {
                                    NameModifier: '_720p',
                                    VideoDescription: {
                                        Width: 1280,
                                        Height: 720,
                                        CodecSettings: {
                                            Codec: 'H_264',
                                            H264Settings: {
                                                RateControlMode: 'QVBR',
                                                QvbrSettings: {
                                                    QvbrQualityLevel: 8
                                                }
                                            }
                                        }
                                    },
                                    AudioDescriptions: [
                                        {
                                            CodecSettings: {
                                                Codec: 'AAC',
                                                AacSettings: {
                                                    Bitrate: 96000,
                                                    CodingMode: 'CODING_MODE_2_0',
                                                    SampleRate: 48000
                                                }
                                            }
                                        }
                                    ],
                                    ContainerSettings: {
                                        Container: 'MP4'
                                    }
                                }
                            ]
                        }
                    ]
                }
            };
            
            // Create MediaConvert job
            const job = await mediaconvert.createJob(params).promise();
            
            console.log(`Started MediaConvert job ${job.Job.Id} for ${key}`);
            
            // Store job information in DynamoDB
            const processingInfo = {
                originalKey: key,
                jobId: job.Job.Id,
                status: 'PROCESSING',
                timestamp: new Date().toISOString()
            };
            
            // If this is a reel, update the reel record
            if (key.includes('/reels/')) {
                // Extract content ID from key
                const contentIdMatch = key.match(/\/reels\/([^\/]+)\//);
                if (contentIdMatch && contentIdMatch[1]) {
                    const userId = contentIdMatch[1];
                    
                    // Store processing information
                    await dynamoDB.put({
                        TableName: 'SocialMedia_VideoProcessing',
                        Item: {
                            videoKey: key,
                            ...processingInfo
                        }
                    }).promise();
                }
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Video processing started successfully' })
        };
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
};