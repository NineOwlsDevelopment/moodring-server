import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string | ReactNode;
  subtitle?: string;
  badge?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

/**
 * Reusable section header with title, optional subtitle, and badge.
 * Uses brand typography and animation patterns.
 */
export const SectionHeader = ({
  title,
  subtitle,
  badge,
  align = 'left',
  size = 'md',
  className = '',
  animated = true,
}: SectionHeaderProps) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  };

  const titleSizes = {
    sm: 'text-2xl lg:text-3xl',
    md: 'text-3xl lg:text-4xl',
    lg: 'text-4xl lg:text-5xl',
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1] as const,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const Wrapper = animated ? motion.div : 'div';
  const SubWrapper = animated ? motion.div : 'div';

  return (
    <Wrapper
      className={`max-w-3xl ${alignClasses[align]} ${className}`}
      {...(animated && {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, margin: '-100px' },
        variants: containerVariants,
      })}
    >
      {badge && (
        <SubWrapper
          {...(animated && { variants: itemVariants })}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-neon-iris/10 border border-neon-iris/20 rounded-full text-neon-iris text-sm font-medium mb-4"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-iris opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-iris" />
          </span>
          {badge}
        </SubWrapper>
      )}
      
      <SubWrapper {...(animated && { variants: itemVariants })}>
        <h2 className={`${titleSizes[size]} font-bold text-white tracking-tight`}>
          {title}
        </h2>
      </SubWrapper>
      
      {subtitle && (
        <SubWrapper {...(animated && { variants: itemVariants })}>
          <p className="mt-4 text-lg text-moon-grey max-w-2xl">
            {subtitle}
          </p>
        </SubWrapper>
      )}
    </Wrapper>
  );
};

