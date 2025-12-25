export interface MarketOption {
  id: string;
  option_label: string;
  option_sub_label?: string | null;
  option_image_url?: string | null;
  yes_shares: number;
  no_shares: number;
  yes_quantity: number;
  no_quantity: number;
  total_volume: number;
  // API-calculated prices (optional, will be calculated client-side if not present)
  yes_price?: number;
  no_price?: number;
  // Resolution fields
  is_resolved?: boolean;
  winning_side?: number | null; // 1 = YES won, 2 = NO won, null = not resolved
  resolved_at?: Date | string | null;
  resolved_reason?: string | null;
  resolved_by?: string | null;
  dispute_deadline?: number | null; // Unix timestamp in seconds, null for OPINION mode options
}

export interface MarketCategory {
  id: string;
  name: string;
}

export interface Market {
  id: string;
  creator_id: string;
  creator_username?: string | null;
  creator_display_name?: string | null;
  creator_avatar_url?: string | null;
  creator_fees_collected: number;
  protocol_fees_collected: number;
  question: string;
  metadata_uri: string;
  market_description: string;
  image_url: string;
  expiration_timestamp: number; // Unix timestamp in seconds
  resolvers: string[];
  required_votes: number;
  resolver_reward: number;
  winning_option: number;
  winning_side: number;
  total_options: number;
  total_volume: number;
  liquidity_parameter: number;
  base_liquidity_parameter: number;
  is_binary: boolean;
  is_verified: boolean;
  is_admin_creator?: boolean;
  is_resolved: boolean;
  is_resolved_at: Date;
  is_initialized: boolean;
  category?: string; // legacy single category
  categories?: MarketCategory[]; // new array of categories
  options: MarketOption[];
  created_at: number;
  updated_at: number;
}

export interface PriceHistoryPoint {
  timestamp: Date;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

export interface UserPosition {
  marketId: string;
  position: "yes" | "no";
  shares: number;
  avgPrice: number;
}
