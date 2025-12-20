/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core Brand Palette
        ink: {
          DEFAULT: "#0A0A0D",
          black: "#0A0A0D",
        },
        graphite: {
          DEFAULT: "#16161B",
          deep: "#16161B",
          light: "#1C1C23",
          hover: "#22222A",
        },
        neon: {
          iris: "#7C4DFF",
          "iris-light": "#9C7AFF",
          "iris-dark": "#5C35CC",
        },
        aqua: {
          pulse: "#21F6D2",
          "pulse-light": "#5FFAE6",
          "pulse-dark": "#18C4A8",
        },
        moon: {
          grey: "#C7C9D1",
          "grey-light": "#E2E4EA",
          "grey-dark": "#8A8C96",
        },
        // Semantic colors matching brand
        brand: {
          success: "#21F6D2",
          "success-muted": "rgba(33, 246, 210, 0.15)",
          danger: "#FF4D6A",
          "danger-muted": "rgba(255, 77, 106, 0.15)",
          warning: "#FFB84D",
          "warning-muted": "rgba(255, 184, 77, 0.15)",
        },
        // Legacy compatibility colors
        primary: {
          50: "#f5f0ff",
          100: "#ede5ff",
          200: "#ddd0ff",
          300: "#c4adff",
          400: "#a67dff",
          500: "#7C4DFF",
          600: "#6b3de6",
          700: "#5C35CC",
          800: "#4a2ba3",
          900: "#3d247a",
        },
        success: {
          50: "#ecfefb",
          100: "#d1fef5",
          200: "#a7fcec",
          300: "#6ff7df",
          400: "#21F6D2",
          500: "#18C4A8",
          600: "#10a08a",
          700: "#0d806e",
          800: "#0a6055",
          900: "#08503e",
        },
        danger: {
          50: "#fff2f4",
          100: "#ffe2e6",
          200: "#ffc9d1",
          300: "#ffa0ae",
          400: "#FF4D6A",
          500: "#e63355",
          600: "#c22545",
          700: "#a31d39",
          800: "#871a33",
          900: "#731a31",
        },
        dark: {
          50: "#f8f8f8",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          750: "#3a3a3a",
          800: "#16161B",
          850: "#121217",
          900: "#0F0F13",
          950: "#0A0A0D",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Satoshi", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        "display-2xl": [
          "4.5rem",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        "display-xl": [
          "3.75rem",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        "display-lg": [
          "3rem",
          { lineHeight: "1.15", letterSpacing: "-0.015em" },
        ],
        "display-md": [
          "2.25rem",
          { lineHeight: "1.2", letterSpacing: "-0.01em" },
        ],
        "display-sm": [
          "1.875rem",
          { lineHeight: "1.25", letterSpacing: "-0.01em" },
        ],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
        34: "8.5rem",
        38: "9.5rem",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        // Neon glow effects
        neon: "0 0 18px rgba(124, 77, 255, 0.45)",
        "neon-strong": "0 0 32px rgba(124, 77, 255, 0.6)",
        "neon-subtle": "0 0 12px rgba(124, 77, 255, 0.25)",
        "neon-spread": "0 4px 24px rgba(124, 77, 255, 0.35)",
        // Aqua glow
        aqua: "0 0 18px rgba(33, 246, 210, 0.4)",
        "aqua-strong": "0 0 32px rgba(33, 246, 210, 0.55)",
        "aqua-subtle": "0 0 12px rgba(33, 246, 210, 0.2)",
        // Brand combined
        brand:
          "0 0 24px rgba(124, 77, 255, 0.35), 0 0 48px rgba(33, 246, 210, 0.15)",
        "brand-hover":
          "0 0 32px rgba(124, 77, 255, 0.5), 0 0 64px rgba(33, 246, 210, 0.25)",
        // Card shadows
        card: "0 4px 20px rgba(0, 0, 0, 0.25)",
        "card-hover":
          "0 8px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(124, 77, 255, 0.15)",
        "card-elevated": "0 12px 40px rgba(0, 0, 0, 0.4)",
        // Button shadows
        "button-primary": "0 4px 16px rgba(124, 77, 255, 0.4)",
        "button-primary-hover": "0 6px 24px rgba(124, 77, 255, 0.55)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #7C4DFF 0%, #21F6D2 100%)",
        "gradient-brand-reverse":
          "linear-gradient(135deg, #21F6D2 0%, #7C4DFF 100%)",
        "gradient-brand-horizontal":
          "linear-gradient(90deg, #7C4DFF 0%, #21F6D2 100%)",
        "gradient-mesh-dark":
          "radial-gradient(ellipse at 30% 20%, rgba(124, 77, 255, 0.15) 0%, transparent 50%)",
        "gradient-mesh-light":
          "radial-gradient(ellipse at 70% 80%, rgba(33, 246, 210, 0.08) 0%, transparent 50%)",
        "gradient-card": "linear-gradient(180deg, #1C1C23 0%, #16161B 100%)",
        "gradient-radial-iris":
          "radial-gradient(circle, rgba(124, 77, 255, 0.2) 0%, transparent 70%)",
        "gradient-radial-aqua":
          "radial-gradient(circle, rgba(33, 246, 210, 0.15) 0%, transparent 70%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.5s ease-out",
        "fade-in-down": "fadeInDown 0.5s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "slide-left": "slideLeft 0.4s ease-out",
        "slide-right": "slideRight 0.4s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-glow": "pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ticker: "ticker 30s linear infinite",
        "ticker-fast": "ticker 18s linear infinite",
        float: "float 6s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "bounce-subtle": "bounceSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideLeft: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": {
            opacity: "0.6",
            boxShadow: "0 0 18px rgba(124, 77, 255, 0.45)",
          },
          "50%": {
            opacity: "1",
            boxShadow: "0 0 32px rgba(124, 77, 255, 0.6)",
          },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
    },
  },
  plugins: [],
};
