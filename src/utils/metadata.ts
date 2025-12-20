import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { compressImage } from "./imageCompression";

export interface Metadata {
  question: string;
  description: string;
  image: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
}

// Initialize S3 client
const getS3Client = () => {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
};

export const uploadImageToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  bucket: string
): Promise<string> => {
  try {
    // Compress and optimize image before upload
    const { buffer: compressedBuffer, mimeType: compressedMimeType } =
      await compressImage(fileBuffer, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 80,
      });

    const s3 = getS3Client();
    // Use webp extension if compressed to webp, otherwise keep original extension
    const extension =
      compressedMimeType === "image/webp"
        ? "webp"
        : fileName.split(".").pop() || "png";
    const key = `images/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: compressedBuffer,
      ContentType: compressedMimeType,
    });

    await s3.send(command);

    // Return the public URL
    // const region = process.env.AWS_REGION || "us-east-1";
    return `https://${process.env.CLOUDFRONT_IMAGE_URL}/${key}`;
  } catch (error) {
    console.error("Error uploading image to S3:", error);
    throw error;
  }
};

export const uploadMetadataToS3 = async (
  tokenMetadata: TokenMetadata,
  imageBuffer: Buffer,
  imageType: string,
  bucket: string,
  mintAddress: string
): Promise<string> => {
  // Compress and optimize image before upload
  const { buffer: compressedBuffer, mimeType: compressedMimeType } =
    await compressImage(imageBuffer, {
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
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: imageKey,
      Body: compressedBuffer,
      ContentType: compressedMimeType,
    })
  );

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
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: jsonKey,
      Body: Buffer.from(JSON.stringify(jsonBody, null, 2)),
      ContentType: "application/json",
    })
  );

  // Return metadata URI for the Metaplex Metadata PDA
  return metadataUrl;
};
