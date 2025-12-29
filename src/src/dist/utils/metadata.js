"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadVideoToS3 = exports.uploadMetadataToS3 = exports.uploadImageToS3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const imageCompression_1 = require("./imageCompression");
// Initialize S3 client
const getS3Client = () => {
    return new client_s3_1.S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
};
const uploadImageToS3 = async (fileBuffer, fileName, fileType, bucket) => {
    try {
        // Compress and optimize image before upload
        const { buffer: compressedBuffer, mimeType: compressedMimeType } = await (0, imageCompression_1.compressImage)(fileBuffer, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 80,
        });
        const s3 = getS3Client();
        // Use webp extension if compressed to webp, otherwise keep original extension
        const extension = compressedMimeType === "image/webp"
            ? "webp"
            : fileName.split(".").pop() || "png";
        const key = `images/${(0, uuid_1.v4)()}.${extension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: compressedBuffer,
            ContentType: compressedMimeType,
        });
        await s3.send(command);
        // Return the public URL
        // const region = process.env.AWS_REGION || "us-east-1";
        return `https://${process.env.CLOUDFRONT_IMAGE_URL}/${key}`;
    }
    catch (error) {
        console.error("Error uploading image to S3:", error);
        throw error;
    }
};
exports.uploadImageToS3 = uploadImageToS3;
const uploadMetadataToS3 = async (tokenMetadata, imageBuffer, imageType, bucket, mintAddress) => {
    // Compress and optimize image before upload
    const { buffer: compressedBuffer, mimeType: compressedMimeType } = await (0, imageCompression_1.compressImage)(imageBuffer, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 80,
    });
    const s3 = getS3Client();
    // Normalize extension based on compressed format
    const extension = compressedMimeType.replace("image/", "") || "png";
    // Store image as <mint>.png, .jpeg, or .webp
    const imageKey = `images/${mintAddress}.${extension}`;
    const jsonKey = `token/${mintAddress}.json`;
    const region = process.env.AWS_REGION || "us-east-1";
    const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${imageKey}`;
    const metadataUrl = `https://${bucket}.s3.${region}.amazonaws.com/${jsonKey}`;
    // 1. Upload compressed image
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: imageKey,
        Body: compressedBuffer,
        ContentType: compressedMimeType,
    }));
    // 2. Create JSON metadata according to Metaplex standard
    const jsonBody = {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        description: tokenMetadata.description,
        image: imageUrl,
        attributes: [],
        properties: {
            files: [
                {
                    uri: imageUrl,
                    type: compressedMimeType,
                },
            ],
            category: "image",
        },
    };
    // 3. Upload JSON metadata
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: jsonKey,
        Body: Buffer.from(JSON.stringify(jsonBody, null, 2)),
        ContentType: "application/json",
    }));
    // Return metadata URI for the Metaplex Metadata PDA
    return metadataUrl;
};
exports.uploadMetadataToS3 = uploadMetadataToS3;
const uploadVideoToS3 = async (fileBuffer, fileName, fileType, bucket) => {
    try {
        const s3 = getS3Client();
        const extension = fileName.split(".").pop() || "mp4";
        const key = `videos/${(0, uuid_1.v4)()}.${extension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: fileType,
        });
        await s3.send(command);
        // Return the public URL
        return `https://${process.env.CLOUDFRONT_IMAGE_URL}/${key}`;
    }
    catch (error) {
        console.error("Error uploading video to S3:", error);
        throw error;
    }
};
exports.uploadVideoToS3 = uploadVideoToS3;
//# sourceMappingURL=metadata.js.map