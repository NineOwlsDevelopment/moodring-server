import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

export const ImageModal = ({ isOpen, onClose, imageUrl, alt = "Image" }: ImageModalProps) => {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getModalRoot = () => {
    return document.getElementById("root") || document.body;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative max-w-7xl max-h-[95vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center text-white hover:text-neon-iris bg-black/50 hover:bg-black/70 rounded-full transition-all backdrop-blur-sm"
          aria-label="Close image"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image */}
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[95vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    getModalRoot()
  );
};

