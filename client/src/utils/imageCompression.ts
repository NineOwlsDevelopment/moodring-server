/**
 * Client-side image compression and resizing utility
 * Uses browser Canvas API - no external dependencies required
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
  outputFormat?: "image/jpeg" | "image/png" | "image/webp";
}

/**
 * Compresses and resizes an image file before upload
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image as File object
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    maxSizeMB = 2,
    outputFormat,
  } = options;

  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    // If file is already small enough, return as-is
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size <= maxSizeBytes) {
      // Still check dimensions
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.width <= maxWidth && img.height <= maxHeight) {
          resolve(file);
        } else {
          // Need to resize
          compressAndResizeImage(img, file, {
            maxWidth,
            maxHeight,
            quality,
            outputFormat,
          })
            .then(resolve)
            .catch(reject);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };

      img.src = url;
      return;
    }

    // Load image for processing
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      compressAndResizeImage(img, file, {
        maxWidth,
        maxHeight,
        quality,
        outputFormat,
      })
        .then(resolve)
        .catch(reject);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Internal function to perform the actual compression and resizing
 */
async function compressAndResizeImage(
  img: HTMLImageElement,
  originalFile: File,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    outputFormat?: "image/jpeg" | "image/png" | "image/webp";
  }
): Promise<File> {
  const { maxWidth, maxHeight, quality, outputFormat } = options;

  // Calculate new dimensions while maintaining aspect ratio
  let { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Use high-quality image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw image to canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Determine output format
  let finalFormat = outputFormat;
  if (!finalFormat) {
    // Check WebP support more reliably
    const supportsWebP = checkWebPSupport();
    if (supportsWebP) {
      finalFormat = "image/webp";
    } else if (originalFile.type === "image/png" && hasTransparency(canvas)) {
      finalFormat = "image/png";
    } else {
      finalFormat = "image/jpeg";
    }
  }

  // Convert to blob with compression
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }

        // Create File object with original filename (adjust extension if format changed)
        const extension = getExtensionForMimeType(finalFormat!);
        const originalName = originalFile.name.replace(/\.[^/.]+$/, "");
        const fileName = `${originalName}.${extension}`;

        const compressedFile = new File([blob], fileName, {
          type: finalFormat!,
          lastModified: Date.now(),
        });

        resolve(compressedFile);
      },
      finalFormat!,
      quality
    );
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  let width = maxWidth;
  let height = maxWidth / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Check if image has transparency (for PNG detection)
 */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  // Sample a few pixels to check for transparency
  const imageData = ctx.getImageData(
    0,
    0,
    Math.min(100, canvas.width),
    Math.min(100, canvas.height)
  );
  const data = imageData.data;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true; // Found transparent or semi-transparent pixel
    }
  }

  return false;
}

/**
 * Check if browser supports WebP format
 */
function checkWebPSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch {
    return false;
  }
}

/**
 * Get file extension for MIME type
 */
function getExtensionForMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return mimeToExt[mimeType] || "jpg";
}

/**
 * Compress image for avatar upload (smaller dimensions)
 */
export async function compressAvatar(
  file: File,
  options: Omit<ImageCompressionOptions, "maxWidth" | "maxHeight"> = {}
): Promise<File> {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
    maxSizeMB: 1,
    ...options,
  });
}

/**
 * Compress image for market cover (medium size)
 */
export async function compressMarketImage(
  file: File,
  options: Omit<ImageCompressionOptions, "maxWidth" | "maxHeight"> = {}
): Promise<File> {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    maxSizeMB: 2,
    ...options,
  });
}

/**
 * Compress image for option thumbnail (small size)
 */
export async function compressOptionImage(
  file: File,
  options: Omit<ImageCompressionOptions, "maxWidth" | "maxHeight"> = {}
): Promise<File> {
  return compressImage(file, {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.8,
    maxSizeMB: 1,
    ...options,
  });
}
