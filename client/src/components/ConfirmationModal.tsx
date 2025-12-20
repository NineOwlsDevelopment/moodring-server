import { X, AlertTriangle } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmationModalProps) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: "bg-brand-danger hover:bg-brand-danger/90 text-white",
      icon: "text-brand-danger",
    },
    warning: {
      button: "bg-amber-500 hover:bg-amber-500/90 text-white",
      icon: "text-amber-500",
    },
    default: {
      button: "bg-neon-iris hover:bg-neon-iris/90 text-white",
      icon: "text-neon-iris",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-graphite-deep rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-moon-grey-dark hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${styles.icon}/10 flex items-center justify-center`}>
            <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>

        {/* Message */}
        <p className="text-moon-grey text-sm mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 ${styles.button} rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

