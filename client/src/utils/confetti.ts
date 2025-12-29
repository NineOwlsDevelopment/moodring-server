/**
 * Confetti celebration utility for Pumpfun-level addictiveness
 * Creates celebratory animations for wins, trades, milestones
 */

export interface ConfettiConfig {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  gravity?: number;
  ticks?: number;
}

const defaultColors = [
  "#7C4DFF", // neon-iris
  "#00E5FF", // aqua-pulse
  "#10B981", // success
  "#F59E0B", // warning
  "#EF4444", // danger
];

/**
 * Create confetti burst effect
 */
export const createConfetti = (config: ConfettiConfig = {}) => {
  const {
    particleCount = 50,
    spread = 70,
    origin = { x: 0.5, y: 0.5 },
    colors = defaultColors,
    gravity = 0.8,
    ticks = 200,
  } = config;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
  }> = [];

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const startX = canvas.width * origin.x;
  const startY = canvas.height * origin.y;

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * spread;
    const velocity = 2 + Math.random() * 4;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      life: ticks,
    });
  }

  let animationFrame: number;
  let currentTick = 0;

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle) => {
      if (particle.life <= 0) return;

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += gravity;
      particle.life--;

      // Draw particle
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    currentTick++;

    if (currentTick < ticks && particles.some((p) => p.life > 0)) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      document.body.removeChild(canvas);
    }
  };

  animate();
};

/**
 * Create success celebration (confetti + emoji)
 */
export const celebrateSuccess = (message?: string) => {
  createConfetti({
    particleCount: 75,
    spread: 60,
    origin: { x: 0.5, y: 0.3 },
  });

  // Show success message if provided
  if (message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #7C4DFF 0%, #00E5FF 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 18px;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(124, 77, 255, 0.4);
      animation: slideDown 0.3s ease-out, fadeOut 0.3s ease-in 2.7s;
    `;
    toast.textContent = message;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
      document.body.removeChild(toast);
      document.head.removeChild(style);
    }, 3000);
  }
};

/**
 * Create number counter animation
 */
export const animateNumber = (
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 1000,
  formatter?: (n: number) => string
) => {
  const startTime = performance.now();
  const difference = to - from;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = from + difference * easeOut;

    element.textContent = formatter ? formatter(current) : current.toFixed(0);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

