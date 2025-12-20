import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface HeroTitleProps {
  children: ReactNode;
  gradient?: boolean;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

/**
 * Brand hero title component with gradient text option.
 * Use for all H1s across the brand for consistent styling.
 */
export const HeroTitle = ({
  children,
  gradient = false,
  size = 'lg',
  className = '',
  animated = true,
}: HeroTitleProps) => {
  const sizeClasses = {
    md: 'text-4xl lg:text-5xl',
    lg: 'text-5xl lg:text-6xl xl:text-7xl',
    xl: 'text-6xl lg:text-7xl xl:text-8xl',
  };

  const baseClasses = `font-extrabold tracking-tight leading-[1.1] ${sizeClasses[size]} ${className}`;

  const content = gradient ? (
    <span className="bg-gradient-brand bg-clip-text text-transparent">
      {children}
    </span>
  ) : (
    <span className="text-white">{children}</span>
  );

  if (animated) {
    return (
      <motion.h1
        className={baseClasses}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        {content}
      </motion.h1>
    );
  }

  return <h1 className={baseClasses}>{content}</h1>;
};

/**
 * Hero subtitle for supporting text below hero titles
 */
export const HeroSubtitle = ({
  children,
  className = '',
  animated = true,
  delay = 0.2,
}: {
  children: ReactNode;
  className?: string;
  animated?: boolean;
  delay?: number;
}) => {
  const baseClasses = `text-lg lg:text-xl text-moon-grey max-w-2xl leading-relaxed ${className}`;

  if (animated) {
    return (
      <motion.p
        className={baseClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay }}
      >
        {children}
      </motion.p>
    );
  }

  return <p className={baseClasses}>{children}</p>;
};

/**
 * Hero badge for "Live on Solana" style indicators
 */
export const HeroBadge = ({
  children,
  pulse = true,
  className = '',
  animated = true,
}: {
  children: ReactNode;
  pulse?: boolean;
  className?: string;
  animated?: boolean;
}) => {
  const content = (
    <div className={`inline-flex items-center gap-2 px-4 py-2 bg-neon-iris/10 border border-neon-iris/20 rounded-full text-neon-iris text-sm font-medium ${className}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-iris opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-iris" />
        </span>
      )}
      {children}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
};

