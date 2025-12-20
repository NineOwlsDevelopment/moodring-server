import { Keypair, PublicKey } from "@solana/web3.js";

export const PROGRAM_ADDRESS = "BARTLZY1PLNUm2aNhdmvBsRRksVovqXRie3FGo9KZZZf";

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const USDC_MINT_ADDRESS = "2uXs1qMB6oAmFC8CH7MbnJWv8cxUmPqxkaV37CUPPzrz";

// local and devnet USDC mint
export const USDC_MINT_KEYPAIR = Keypair.fromSecretKey(
  new Uint8Array([
    40, 10, 169, 30, 71, 80, 96, 99, 78, 207, 13, 125, 123, 49, 24, 65, 163,
    253, 236, 83, 240, 170, 173, 140, 193, 31, 57, 58, 79, 207, 137, 199, 28,
    80, 200, 254, 89, 126, 48, 64, 214, 14, 104, 141, 28, 88, 220, 108, 131,
    149, 81, 105, 212, 251, 208, 149, 25, 54, 205, 214, 223, 139, 8, 199,
  ])
);
