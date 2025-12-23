import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

/**
 * Tooltip Component
 *
 * A reusable tooltip that appears on hover to provide contextual information.
 * Matches Moodring design system with graphite backgrounds and neon accents.
 */
export const Tooltip = ({
  content,
  children,
  position = "top",
  delay = 300,
  className = "",
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Use getBoundingClientRect which gives viewport coordinates
    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + 8;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) {
      // If top doesn't fit, show below instead
      if (position === "top") {
        top = triggerRect.bottom + 8;
      } else {
        top = padding;
      }
    }
    if (top + tooltipRect.height > window.innerHeight - padding) {
      // If bottom doesn't fit, show above instead
      if (position === "bottom") {
        top = triggerRect.top - tooltipRect.height - 8;
      } else {
        top = window.innerHeight - tooltipRect.height - padding;
      }
    }

    setTooltipPosition({ top, left });
    setIsPositioned(true);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsPositioned(false); // Reset positioning state
      setIsVisible(true);
      // Use requestAnimationFrame to ensure tooltip is rendered before calculating position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition();
        });
      });
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setIsPositioned(false);
  };

  useEffect(() => {
    if (isVisible) {
      // Recalculate position when tooltip becomes visible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition();
        });
      });

      const handleScroll = () => {
        requestAnimationFrame(calculatePosition);
      };
      const handleResize = () => {
        requestAnimationFrame(calculatePosition);
      };
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipContent = isVisible ? (
    <div
      ref={tooltipRef}
      className={`fixed z-[400] pointer-events-none transition-opacity duration-75 ${
        isPositioned ? "opacity-100" : "opacity-0"
      }`}
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        visibility: isPositioned ? "visible" : "hidden",
      }}
    >
      <div className="relative">
        <div className="bg-graphite-deep rounded-lg px-3 py-2 text-sm text-white shadow-card-elevated border border-white/10 backdrop-blur-sm max-w-xs">
          {/* Gradient accent line */}
          <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent rounded-t-lg" />
          {typeof content === "string" ? (
            <p className="text-moon-grey leading-relaxed">{content}</p>
          ) : (
            content
          )}
        </div>
        {/* Arrow */}
        <div
          className={`absolute w-2 h-2 bg-graphite-deep border border-white/10 ${
            position === "top"
              ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 border-t-0 border-l-0"
              : position === "bottom"
              ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b-0 border-r-0"
              : position === "left"
              ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45 border-l-0 border-b-0"
              : "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45 border-r-0 border-t-0"
          }`}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </div>
      {typeof document !== "undefined" &&
        createPortal(tooltipContent, document.body)}
    </>
  );
};
