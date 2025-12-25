"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressImage = compressImage;
exports.compressThumbnail = compressThumbnail;
const sharp_1 = __importDefault(require("sharp"));
/**
 * Compresses and resizes an image to minimize file size while maintaining quality
 * @param imageBuffer - Original image buffer
 * @param options - Compression options
 * @returns Compressed image buffer and updated mime type
 */
async function compressImage(imageBuffer, options = {}) {
    const { maxWidth = 1600, maxHeight = 1200, quality = 80, format } = options;
    try {
        // Get image metadata to determine original format
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        const originalFormat = metadata.format;
        // Determine output format - prefer WebP for better compression, fallback to original format
        let outputFormat = format || "webp";
        // If format not specified, use WebP for photos, PNG for graphics with transparency
        if (!format) {
            if (originalFormat === "png" && metadata.hasAlpha) {
                // Keep PNG if it has transparency
                outputFormat = "png";
            }
            else {
                // Use WebP for better compression on photos
                outputFormat = "webp";
            }
        }
        // Start processing
        let pipeline = (0, sharp_1.default)(imageBuffer).resize(maxWidth, maxHeight, {
            fit: "inside",
            withoutEnlargement: true, // Don't enlarge smaller images
        });
        // Apply format-specific optimizations
        if (outputFormat === "webp") {
            pipeline = pipeline.webp({ quality, effort: 6 });
        }
        else if (outputFormat === "jpeg") {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }
        else if (outputFormat === "png") {
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
    }
    catch (error) {
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
async function compressThumbnail(imageBuffer) {
    return compressImage(imageBuffer, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 70,
        format: "webp",
    });
}
//# sourceMappingURL=imageCompression.js.map