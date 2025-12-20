/**
 * Utility functions for adding artificial delays to improve UX
 * Prevents jarring transitions when operations complete too quickly
 */

/**
 * Ensures a promise takes at least a minimum amount of time
 * Useful for making fast operations feel more natural
 *
 * @param promise - The promise to wrap
 * @param minDelayMs - Minimum delay in milliseconds (default: 1000ms)
 * @param variationMs - Random variation to add/subtract (default: 200ms) for more natural feel
 * @returns Promise that resolves after at least minDelayMs (with variation)
 */
export const withMinimumDelay = async <T>(
  promise: Promise<T>,
  minDelayMs: number = 500,
  variationMs: number = 50
): Promise<T> => {
  const startTime = Date.now();

  // Add slight random variation to make delays feel more natural
  // Variation is ±variationMs, so delay will be between (minDelayMs - variationMs) and (minDelayMs + variationMs)
  const variation = (Math.random() * 2 - 1) * variationMs; // -variationMs to +variationMs
  const actualDelay = Math.max(0, minDelayMs + variation);

  // Wait for both the promise and the minimum delay
  const [result] = await Promise.all([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, actualDelay)),
  ]);

  // Ensure we've waited at least the minimum (accounting for variation)
  const elapsed = Date.now() - startTime;
  const minActualDelay = Math.max(0, minDelayMs - variationMs);
  if (elapsed < minActualDelay) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, minActualDelay - elapsed)
    );
  }

  return result;
};

/**
 * Creates a delay promise
 * @param ms - Milliseconds to delay
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wraps an async function to ensure it takes at least a minimum time
 * @param fn - The async function to wrap
 * @param minDelayMs - Minimum delay in milliseconds (default: 1000ms)
 */
export const withMinDelay = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  minDelayMs: number = 1000
): T => {
  return ((...args: Parameters<T>) => {
    return withMinimumDelay(fn(...args), minDelayMs);
  }) as T;
};
