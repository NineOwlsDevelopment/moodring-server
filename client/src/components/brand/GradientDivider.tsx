import { motion } from 'framer-motion';

interface GradientDividerProps {
  className?: string;
  vertical?: boolean;
  animated?: boolean;
}

/**
 * Brand Signature Component
 * A gradient line divider using the Moodring brand gradient.
 * Use this everywhere for visual breaks and accents.
 */
export const GradientDivider = ({ 
  className = '', 
  vertical = false,
  animated = false 
}: GradientDividerProps) => {
  const baseClasses = vertical
    ? 'w-px h-full bg-gradient-brand opacity-70'
    : 'h-px w-full bg-gradient-brand-horizontal opacity-70';

  if (animated) {
    return (
      <motion.div
        className={`${baseClasses} ${className}`}
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 0.7 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />
    );
  }

  return <div className={`${baseClasses} ${className}`} />;
};

