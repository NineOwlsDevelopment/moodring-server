import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";

import { BANNED_WORDS } from "./bannedWordsList";

/**
 * Initialize Rekognition client
 */
const getRekognitionClient = () => {
  return new RekognitionClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
};

/**
 * NSFW moderation labels to check for
 * These are the labels that AWS Rekognition returns for inappropriate content
 */
const NSFW_LABELS = [
  "Explicit Nudity",
  "Suggestive",
  "Violence",
  "Visually Disturbing",
  "Hate Symbols",
];

/**
 * Check if text contains banned words
 * @param text - The text to check
 * @param caseSensitive - Whether the check should be case sensitive (default: false)
 * @returns Object with containsBannedWords boolean and the list of found banned words
 */
export const checkBannedWords = (
  text: string,
  caseSensitive: boolean = false
): {
  containsBannedWords: boolean;
  bannedWordsFound: string[];
} => {
  if (!text || typeof text !== "string") {
    return {
      containsBannedWords: false,
      bannedWordsFound: [],
    };
  }

  const normalizedText = caseSensitive ? text : text.toLowerCase();
  const normalizedBannedWords = caseSensitive
    ? BANNED_WORDS
    : BANNED_WORDS.map((word) => word.toLowerCase());

  // Split text into words and check each word
  // Also check for banned words as substrings to catch variations
  const words = normalizedText.split(/\s+/);
  const foundBannedWords: string[] = [];

  for (const bannedWord of normalizedBannedWords) {
    // Check if banned word appears as a whole word
    const wordBoundaryRegex = new RegExp(`\\b${bannedWord}\\b`, "i");

    if (wordBoundaryRegex.test(normalizedText)) {
      // Find the original case version from BANNED_WORDS
      const originalWord = BANNED_WORDS.find(
        (w) => w.toLowerCase() === bannedWord.toLowerCase()
      );
      if (originalWord && !foundBannedWords.includes(originalWord)) {
        foundBannedWords.push(originalWord);
      }
    }
  }

  return {
    containsBannedWords: foundBannedWords.length > 0,
    bannedWordsFound: foundBannedWords,
  };
};

/**
 * Validate text content for banned words
 * @param text - The text to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateTextContent = (
  text: string,
  fieldName: string = "Content"
): {
  isValid: boolean;
  error?: string;
  bannedWordsFound?: string[];
} => {
  if (!text || typeof text !== "string") {
    return {
      isValid: true, // Empty text is valid (length validation handled elsewhere)
      bannedWordsFound: [],
    };
  }

  const result = checkBannedWords(text);

  if (result.containsBannedWords) {
    return {
      isValid: false,
      error: `${fieldName} contains inappropriate language and cannot be used.`,
      bannedWordsFound: result.bannedWordsFound,
    };
  }

  return {
    isValid: true,
    bannedWordsFound: [],
  };
};

/**
 * Check if an image contains NSFW content using AWS Rekognition
 * @param imageBuffer - The image file buffer
 * @param minConfidence - Minimum confidence threshold (0-100). Default: 50
 * @returns Object with isNSFW boolean and details about detected content
 */
export const detectNSFWContent = async (
  imageBuffer: Buffer,
  minConfidence: number = 50
): Promise<{
  isNSFW: boolean;
  detectedLabels: Array<{ name: string; confidence: number }>;
  error?: string;
}> => {
  try {
    // If AWS credentials are not configured, skip moderation (for development)
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn(
        "AWS credentials not configured. Skipping NSFW detection. This should only happen in development."
      );
      return {
        isNSFW: false,
        detectedLabels: [],
        error: "AWS credentials not configured",
      };
    }

    const rekognition = getRekognitionClient();

    // AWS Rekognition requires images to be at least 80x80 pixels
    // and max 15MB. We'll check the buffer size first.
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageBuffer.length > maxSize) {
      return {
        isNSFW: true,
        detectedLabels: [
          { name: "File too large for moderation", confidence: 100 },
        ],
        error: "Image file is too large for content moderation",
      };
    }

    const command = new DetectModerationLabelsCommand({
      Image: {
        Bytes: imageBuffer,
      },
      MinConfidence: minConfidence,
    });

    const response = await rekognition.send(command);

    // Check if any NSFW labels were detected
    const detectedLabels =
      response.ModerationLabels?.filter((label: any) => {
        if (!label.Name) return false;
        return (
          NSFW_LABELS.includes(label.Name) &&
          (label.Confidence || 0) >= minConfidence
        );
      }).map((label: any) => ({
        name: label.Name || "Unknown",
        confidence: label.Confidence || 0,
      })) || [];

    const isNSFW = detectedLabels.length > 0;

    return {
      isNSFW,
      detectedLabels,
    };
  } catch (error: any) {
    console.error("Error detecting NSFW content:", error);

    // If Rekognition service is unavailable, we can either:
    // 1. Block the upload (safer but may cause issues if AWS is down)
    // 2. Allow the upload with a warning (less safe but more resilient)
    // For now, we'll block it to be safe, but you can change this behavior
    return {
      isNSFW: true,
      detectedLabels: [],
      error: `Content moderation service error: ${error.message}`,
    };
  }
};

/**
 * Validate image before upload
 * Checks file type, size, and NSFW content
 */
export const validateImage = async (
  imageBuffer: Buffer,
  mimetype: string,
  maxSizeMB: number = 10
): Promise<{
  isValid: boolean;
  error?: string;
  nsfwDetails?: {
    isNSFW: boolean;
    detectedLabels: Array<{ name: string; confidence: number }>;
  };
}> => {
  // Check file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(mimetype.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (imageBuffer.length > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check for NSFW content
  const nsfwResult = await detectNSFWContent(imageBuffer);

  if (nsfwResult.isNSFW) {
    return {
      isValid: false,
      error: "Image contains inappropriate content and cannot be uploaded",
      nsfwDetails: {
        isNSFW: true,
        detectedLabels: nsfwResult.detectedLabels,
      },
    };
  }

  return {
    isValid: true,
    nsfwDetails: {
      isNSFW: false,
      detectedLabels: [],
    },
  };
};
