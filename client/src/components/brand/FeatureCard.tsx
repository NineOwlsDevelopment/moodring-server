import { memo, ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
  variant?: "default" | "horizontal";
  className?: string;
}

/**
 * Feature card for "How It Works" sections and feature showcases.
 * Uses CSS animations for better performance (no framer-motion overhead).
 */
export const FeatureCard = memo(
  ({
    icon,
    title,
    description,
    index = 0,
    variant = "default",
    className = "",
  }: FeatureCardProps) => {
    // CSS animation delay based on index
    const animationStyle = {
      animationDelay: `${index * 100}ms`,
    };

    if (variant === "horizontal") {
      return (
        <div
          className={`group relative flex gap-6 p-6 bg-graphite-deep rounded-2xl border border-white/5 hover:border-neon-iris/30 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up ${className}`}
          style={animationStyle}
        >
          {/* Icon container */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-2xl shadow-button-primary group-hover:shadow-button-primary-hover transition-shadow">
            {icon}
          </div>

          {/* Content */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-gradient transition-all">
              {title}
            </h3>
            <p className="text-moon-grey text-sm leading-relaxed">
              {description}
            </p>
          </div>

          {/* Hover glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-brand opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
        </div>
      );
    }

    return (
      <div
        className={`group relative text-center p-8 bg-graphite-deep rounded-2xl border border-white/5 hover:border-neon-iris/30 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up ${className}`}
        style={animationStyle}
      >
        {/* Icon container */}
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-brand items-center justify-center text-white text-2xl mb-6 shadow-button-primary group-hover:shadow-button-primary-hover group-hover:scale-110 transition-all">
          {icon}
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-gradient transition-all">
          {title}
        </h3>
        <p className="text-moon-grey leading-relaxed">{description}</p>

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-brand opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
      </div>
    );
  }
);

FeatureCard.displayName = "FeatureCard";

/**
 * Step card with number indicator
 * Uses CSS animations for better performance
 */
export const StepCard = memo(
  ({
    step,
    title,
    description,
    index = 0,
    className = "",
  }: {
    step: number;
    title: string;
    description: string;
    index?: number;
    className?: string;
  }) => {
    // CSS animation delay based on index
    const animationStyle = {
      animationDelay: `${index * 150}ms`,
    };

    return (
      <div
        className={`group relative text-center animate-fade-in-up ${className}`}
        style={animationStyle}
      >
        {/* Step number */}
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-brand rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-button-primary group-hover:shadow-button-primary-hover group-hover:scale-110 transition-all">
          {step}
        </div>

        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-moon-grey leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      </div>
    );
  }
);

StepCard.displayName = "StepCard";
