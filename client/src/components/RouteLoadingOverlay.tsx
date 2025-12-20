import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { delay } from "@/utils/delay";

/**
 * Component that shows a loading overlay during route transitions
 * Ensures the overlay is visible for a minimum duration to prevent jarring transitions
 */
export const RouteLoadingOverlay = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show loading overlay when route changes
    setIsLoading(true);
    setIsVisible(true);

    // Keep overlay visible for minimum duration (225-275ms with variation)
    const minDelay = 250 + (Math.random() * 2 - 1) * 25;

    delay(minDelay).then(() => {
      setIsLoading(false);
      // Fade out after a brief moment
      setTimeout(() => {
        setIsVisible(false);
      }, 100);
    });
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm transition-opacity duration-200 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
    />
  );
};
