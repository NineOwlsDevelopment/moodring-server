import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { Activity, X, ChevronUp } from "lucide-react";

/**
 * Floating Activity Feed Widget
 * Minimized by default, can be expanded
 * Positioned in bottom-right corner
 */
export const FloatingActivityFeed = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Floating Button - Always visible */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-neon-iris to-aqua-pulse shadow-lg shadow-neon-iris/30 flex items-center justify-center text-white hover:shadow-xl hover:shadow-neon-iris/40 transition-all"
        aria-label="Toggle activity feed"
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Activity className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Pulse indicator */}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-success rounded-full animate-ping" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-success rounded-full" />
      </motion.button>

      {/* Expanded Feed Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            />

            {/* Feed Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] max-h-[600px]"
            >
              <LiveActivityFeed limit={12} showHeader={true} compact={false} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

