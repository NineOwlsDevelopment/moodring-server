/**
 * Bonding curve pricing utility (friend.tech style)
 * 
 * Formula: price = (supply^2) / 16000
 * 
 * This creates a quadratic bonding curve where:
 * - Price increases quadratically with supply
 * - Each key purchase increases the price for the next purchase
 * - Selling keys decreases the supply and price
 */

/**
 * Calculate the price for a key at a given supply
 * @param supply - Current supply of keys
 * @returns Price in USDC
 */
export function getKeyPrice(supply: number): number {
  if (supply < 0) {
    return 0;
  }
  return (supply * supply) / 16000;
}

/**
 * Calculate the cost to buy N keys starting from a given supply
 * This integrates the bonding curve from supply to supply + quantity
 * 
 * Cost = integral from supply to supply+quantity of (x^2 / 16000) dx
 *      = (1/16000) * integral from supply to supply+quantity of x^2 dx
 *      = (1/16000) * [(supply+quantity)^3 - supply^3] / 3
 *      = [(supply+quantity)^3 - supply^3] / 48000
 * 
 * @param supply - Current supply before purchase
 * @param quantity - Number of keys to buy
 * @returns Total cost in USDC
 */
export function getBuyCost(supply: number, quantity: number): number {
  if (quantity <= 0) {
    return 0;
  }
  if (supply < 0) {
    supply = 0;
  }
  
  const supplyAfter = supply + quantity;
  const cost = (Math.pow(supplyAfter, 3) - Math.pow(supply, 3)) / 48000;
  return Math.max(0, cost);
}

/**
 * Calculate the payout for selling N keys starting from a given supply
 * This is the integral from supply-quantity to supply
 * 
 * Payout = integral from supply-quantity to supply of (x^2 / 16000) dx
 *        = [(supply)^3 - (supply-quantity)^3] / 48000
 * 
 * @param supply - Current supply before sale
 * @param quantity - Number of keys to sell
 * @returns Total payout in USDC
 */
export function getSellPayout(supply: number, quantity: number): number {
  if (quantity <= 0) {
    return 0;
  }
  if (supply <= 0) {
    return 0;
  }
  if (supply < quantity) {
    quantity = supply; // Can't sell more than exists
  }
  
  const supplyBefore = supply;
  const supplyAfter = supply - quantity;
  const payout = (Math.pow(supplyBefore, 3) - Math.pow(supplyAfter, 3)) / 48000;
  return Math.max(0, payout);
}

