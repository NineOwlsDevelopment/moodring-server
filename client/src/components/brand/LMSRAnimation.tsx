import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

/**
 * LMSR liquidity curve animation that morphs based on scroll position.
 * Represents the cost curve, probability curve, and liquidity surface.
 */
export const LMSRAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Transform scroll progress to animation states
  const curveProgress = useTransform(scrollYProgress, [0.2, 0.8], [0, 1]);
  const rotation = useTransform(scrollYProgress, [0.2, 0.8], [0, 180]);
  const scale = useTransform(scrollYProgress, [0.2, 0.5, 0.8], [0.8, 1.1, 1]);

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-md mx-auto">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial-iris opacity-50 blur-3xl" />
      
      <motion.svg
        viewBox="0 0 400 400"
        className="w-full h-full relative z-10"
        style={{ scale }}
      >
        {/* Outer ring */}
        <motion.circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke="url(#gradientBrand)"
          strokeWidth="1"
          opacity="0.3"
          style={{ rotate: rotation }}
        />

        {/* Middle ring with dashes */}
        <motion.circle
          cx="200"
          cy="200"
          r="140"
          fill="none"
          stroke="url(#gradientBrand)"
          strokeWidth="2"
          strokeDasharray="10 20"
          opacity="0.5"
          style={{ rotate: rotation }}
        />

        {/* Inner animated curve - LMSR cost curve representation */}
        <motion.path
          d="M 60 200 Q 120 100, 200 100 T 340 200"
          fill="none"
          stroke="url(#gradientBrand)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          style={{ 
            pathLength: curveProgress,
            opacity: useTransform(curveProgress, [0, 0.3], [0, 1]),
          }}
        />

        {/* Probability curve */}
        <motion.path
          d="M 60 300 Q 140 180, 200 200 T 340 100"
          fill="none"
          stroke="#21F6D2"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          style={{ 
            pathLength: useTransform(curveProgress, [0.2, 0.9], [0, 1]),
          }}
        />

        {/* Center node */}
        <motion.circle
          cx="200"
          cy="200"
          r="12"
          fill="url(#gradientBrand)"
          style={{
            scale: useTransform(curveProgress, [0, 0.5, 1], [0, 1.2, 1]),
          }}
        />

        {/* Orbiting dots */}
        {[0, 1, 2, 3].map((i) => (
          <motion.circle
            key={i}
            cx="200"
            cy="200"
            r="4"
            fill={i % 2 === 0 ? '#7C4DFF' : '#21F6D2'}
            style={{
              translateX: useTransform(
                scrollYProgress,
                [0, 1],
                [0, Math.cos((i * Math.PI) / 2) * 100]
              ),
              translateY: useTransform(
                scrollYProgress,
                [0, 1],
                [0, Math.sin((i * Math.PI) / 2) * 100]
              ),
              opacity: useTransform(curveProgress, [0.3, 0.6], [0, 0.8]),
            }}
          />
        ))}

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="gradientBrand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C4DFF" />
            <stop offset="100%" stopColor="#21F6D2" />
          </linearGradient>
        </defs>
      </motion.svg>
    </div>
  );
};

/**
 * Simplified version for smaller displays or performance
 */
export const LMSRAnimationSimple = () => {
  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial-iris opacity-40 blur-3xl animate-pulse-slow" />
      
      <svg viewBox="0 0 200 200" className="w-full h-full relative z-10">
        {/* Outer ring */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="url(#gradSimple)"
          strokeWidth="1"
          opacity="0.3"
          className="animate-spin-slow"
        />

        {/* LMSR curve */}
        <path
          d="M 20 100 Q 60 50, 100 50 T 180 100"
          fill="none"
          stroke="url(#gradSimple)"
          strokeWidth="2"
          strokeLinecap="round"
          className="animate-pulse"
        />

        {/* Center */}
        <circle
          cx="100"
          cy="100"
          r="8"
          fill="url(#gradSimple)"
          className="animate-pulse"
        />

        <defs>
          <linearGradient id="gradSimple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C4DFF" />
            <stop offset="100%" stopColor="#21F6D2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

