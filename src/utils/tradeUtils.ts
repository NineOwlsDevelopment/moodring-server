import { PoolClient } from "pg";

/**
 * Calculate fees for a trade
 */
export function calculateFees(
  amount: number,
  protocolFeeBps: number,
  creatorFeeBps: number,
  lpFeeBps: number
): {
  protocolFee: number;
  creatorFee: number;
  lpFee: number;
  totalFee: number;
  netAmount: number;
} {
  const totalFee = Math.floor(
    (amount * (protocolFeeBps + creatorFeeBps + lpFeeBps)) / 10000
  );
  const protocolFee = Math.floor((amount * protocolFeeBps) / 10000);
  const creatorFee = Math.floor((amount * creatorFeeBps) / 10000);
  const lpFee = Math.floor((amount * lpFeeBps) / 10000);

  console.log("totalFee", totalFee);
  console.log("protocolFee", protocolFee);
  console.log("creatorFee", creatorFee);
  console.log("lpFee", lpFee);
  console.log("amount", amount);

  return {
    protocolFee,
    creatorFee,
    lpFee,
    totalFee,
    netAmount: amount - totalFee,
  };
}

/**
 * Get moodring configuration data
 */
export async function getMoodringData(client: PoolClient) {
  const moodringResult = await client.query(`SELECT * FROM moodring`);
  const moodring = moodringResult.rows[0];
  if (!moodring) {
    console.log("Moodring data not set");
    throw new Error("Moodring not found");
  }
  return moodring;
}

/**
 * Check admin controls for trading operations
 */
export async function checkAdminControls(client: PoolClient) {
  const moodring = await getMoodringData(client);

  if (moodring.maintenance_mode) {
    throw new Error(
      "Platform is currently under maintenance. Trading is temporarily disabled."
    );
  }

  if (!moodring.allow_trading) {
    throw new Error("Trading is currently disabled by administrators.");
  }

  if (moodring.pause_trading) {
    throw new Error("Trading is temporarily paused");
  }

  return moodring;
}
