import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Share2, Code } from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketUrl: string;
  marketTitle?: string;
  marketDescription?: string;
}

export const ShareModal = ({ isOpen, onClose, marketUrl }: ShareModalProps) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [_, setApiUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Get API URL from environment
      const envApiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:5001/api";
      setApiUrl(envApiUrl);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getModalRoot = () => {
    return document.getElementById("root") || document.body;
  };

  const copyToClipboard = async (text: string, type: "link" | "embed") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast.success("Link copied to clipboard!");
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
        toast.success("Embed code copied to clipboard!");
      }
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const embedCode = `<iframe src="${marketUrl}" width="400" height="600" frameborder="0" allowfullscreen></iframe>`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative bg-graphite-deep rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-moon-grey hover:text-white transition-colors rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <Share2 className="w-5 h-5 text-neon-iris" />
            <h2 className="text-xl font-bold text-white">Share Market</h2>
          </div>
          <p className="text-sm text-moon-grey">
            Share this market with others
          </p>
        </div>

        {/* Share Link Section */}
        <div className="space-y-4">
          {/* Copy Link */}
          <div>
            <label className="block text-sm font-medium text-moon-grey mb-2">
              Market Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-graphite-light rounded-lg p-3 border border-white/5">
                <p className="text-sm text-white break-all">{marketUrl}</p>
              </div>
              <button
                onClick={() => copyToClipboard(marketUrl, "link")}
                className="flex-shrink-0 px-4 py-3 bg-neon-iris hover:bg-neon-iris-light text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm font-medium">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Embed Code */}
          <div>
            <label className="block text-sm font-medium text-moon-grey mb-2">
              Embed Code
            </label>
            <div className="flex items-start gap-2">
              <div className="flex-1 bg-graphite-light rounded-lg p-3 border border-white/5">
                <code className="text-xs text-moon-grey break-all font-mono">
                  {embedCode}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(embedCode, "embed")}
                className="flex-shrink-0 px-4 py-3 bg-graphite-light hover:bg-graphite-hover text-white rounded-lg transition-colors flex items-center gap-2 border border-white/10"
              >
                {copiedEmbed ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Code className="w-4 h-4" />
                    <span className="text-sm font-medium">Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-moon-grey/70 mt-2">
              Paste this code into your website to embed the market
            </p>
          </div>
        </div>
      </div>
    </div>,
    getModalRoot()
  );
};
