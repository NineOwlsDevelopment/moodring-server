import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Share2, Code } from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketUrl: string;
  marketTitle: string;
  marketDescription: string;
}

export const ShareModal = ({
  isOpen,
  onClose,
  marketUrl,
  marketTitle,
}: ShareModalProps) => {
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

  const embedCode = `<iframe src="${marketUrl}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;

  const shareToTwitter = () => {
    const text = encodeURIComponent(marketTitle);
    const url = encodeURIComponent(marketUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "width=550,height=420"
    );
  };

  const shareToDiscord = () => {
    // Discord doesn't have a direct share URL, but we can copy the link
    copyToClipboard(marketUrl, "link");
    toast.info("Link copied! Paste it in Discord to share.");
  };

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

          {/* Social Sharing */}
          <div>
            <label className="block text-sm font-medium text-moon-grey mb-3">
              Share on Social Media
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareToTwitter}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
                <span className="text-sm font-medium">Twitter</span>
              </button>

              <button
                onClick={shareToDiscord}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span className="text-sm font-medium">Discord</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    getModalRoot()
  );
};
