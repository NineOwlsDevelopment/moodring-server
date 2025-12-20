import { create } from "zustand";
import { Market, UserPosition } from "@/types/market";

type MarketUpdater = Market[] | ((currentMarkets: Market[]) => Market[]);

interface MarketState {
  markets: Market[];
  userPositions: UserPosition[];
  selectedCategory: string;
  setMarkets: (updater: MarketUpdater) => void;
  setUserPositions: (positions: UserPosition[]) => void;
  setSelectedCategory: (category: string) => void;
  addPosition: (position: UserPosition) => void;
  updatePosition: (marketId: string, shares: number, avgPrice: number) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  markets: [],
  userPositions: [],
  selectedCategory: "all",
  setMarkets: (updater) =>
    set((state) => ({
      // Accept either a new array or a functional updater so pagination can merge results
      markets:
        typeof updater === "function"
          ? (updater as (currentMarkets: Market[]) => Market[])(state.markets)
          : updater,
    })),
  setUserPositions: (positions) => set({ userPositions: positions }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  addPosition: (position) =>
    set((state) => ({
      userPositions: [...state.userPositions, position],
    })),
  updatePosition: (marketId, shares, avgPrice) =>
    set((state) => ({
      userPositions: state.userPositions.map((pos) =>
        pos.marketId === marketId ? { ...pos, shares, avgPrice } : pos
      ),
    })),
}));
