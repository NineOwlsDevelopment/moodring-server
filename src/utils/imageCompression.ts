import sharp from "sharp";

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "jpeg" | "png" | "webp";
}

/**
 * Compresses and resizes an image to minimize file size while maintaining quality
 * @param imageBuffer - Original image buffer
 * @param options - Compression options
 * @returns Compressed image buffer and updated mime type
 */
export async function compressImage(
  imageBuffer: Buffer,
  options: ImageCompressionOptions = {}
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { maxWidth = 1600, maxHeight = 1200, quality = 80, format } = options;

  try {
    // Get image metadata to determine original format
    const metadata = await sharp(imageBuffer).metadata();
    const originalFormat = metadata.format;

    // Determine output format - prefer WebP for better compression, fallback to original format
    let outputFormat: "jpeg" | "png" | "webp" = format || "webp";

    // If format not specified, use WebP for photos, PNG for graphics with transparency
    if (!format) {
      if (originalFormat === "png" && metadata.hasAlpha) {
        // Keep PNG if it has transparency
        outputFormat = "png";
      } else {
        // Use WebP for better compression on photos
        outputFormat = "webp";
      }
    }

    // Start processing
    let pipeline = sharp(imageBuffer).resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true, // Don't enlarge smaller images
    });

    // Apply format-specific optimizations
    if (outputFormat === "webp") {
      pipeline = pipeline.webp({ quality, effort: 6 });
    } else if (outputFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (outputFormat === "png") {
      pipeline = pipeline.png({
        quality,
        compressionLevel: 9,
        adaptiveFiltering: true,
      });
    }

    const compressedBuffer = await pipeline.toBuffer();

    // Determine mime type
    const mimeType = `image/${outputFormat}`;

    return {
      buffer: compressedBuffer,
      mimeType,
    };
  } catch (error) {
    console.error("Error compressing image:", error);
    // If compression fails, return original buffer
    return {
      buffer: imageBuffer,
      mimeType: "image/jpeg", // Default fallback
    };
  }
}

/**
 * Compresses images for thumbnails (smaller size, lower quality)
 */
export async function compressThumbnail(
  imageBuffer: Buffer
): Promise<{ buffer: Buffer; mimeType: string }> {
  return compressImage(imageBuffer, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 70,
    format: "webp",
  });
}
