import { create } from "zustand";

export enum ResolutionMode {
  ORACLE = "ORACLE",
  AUTHORITY = "AUTHORITY",
  OPINION = "OPINION",
}

export enum MarketStatus {
  OPEN = "OPEN",
  RESOLVING = "RESOLVING",
  RESOLVED = "RESOLVED",
  DISPUTED = "DISPUTED",
}

export interface ResolutionConfig {
  authorityResolverId?: string;
  witnessIds?: string[];
  quorumSize?: number;
  minJurors?: number;
  consensusThreshold?: number;
  snapshotTimestamp?: number;
  bondAmount?: number;
  disputeWindowHours?: number;
  escalationPath?: string;
}

export interface ResolutionInfo {
  resolutionMode: ResolutionMode | null;
  resolver: {
    id: string;
    name: string;
    type: string;
    bondBalance: number;
    reputationScore: number;
  } | null;
  bond: number;
  disputeWindow: number; // hours
  resolutionStatus: MarketStatus;
}

interface ResolutionState {
  resolutionInfo: ResolutionInfo | null;
  setResolutionInfo: (info: ResolutionInfo | null) => void;
  clearResolutionInfo: () => void;
}

export const useResolutionStore = create<ResolutionState>((set) => ({
  resolutionInfo: null,
  setResolutionInfo: (info) => set({ resolutionInfo: info }),
  clearResolutionInfo: () => set({ resolutionInfo: null }),
}));
