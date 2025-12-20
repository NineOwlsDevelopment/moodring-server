import { io, Socket } from "socket.io-client";

// Socket server URL - strip /api suffix if present since Socket.IO uses root namespace
const getSocketUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";
  // Remove /api suffix if present, as Socket.IO treats paths as namespaces
  return apiUrl.replace(/\/api\/?$/, "");
};
const SOCKET_URL = getSocketUrl();

// Types for socket events
export interface TradeUpdate {
  market_id: string;
  option_id: string;
  trade_type: "buy" | "sell";
  side: "yes" | "no";
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface PriceUpdate {
  option_id: string;
  yes_price: number;
  no_price: number;
  yes_quantity: number;
  no_quantity: number;
  timestamp: Date;
}

export interface MarketUpdate {
  market_id: string;
  event: "created" | "resolved" | "initialized" | "updated";
  data: Record<string, any>;
  timestamp: Date;
}

export interface ActivityUpdate {
  activity_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  username?: string;
  timestamp: Date;
}

export interface BalanceUpdate {
  user_id: string;
  balance_usdc: number;
  timestamp: Date;
}

export interface CommentUpdate {
  comment_id: string;
  market_id: string;
  parent_id?: string | null;
  event: "created" | "updated" | "deleted" | "voted";
  comment?: any; // Full comment object for created/updated events
  upvotes?: number;
  downvotes?: number;
  timestamp: Date;
}

export interface LiveRoomParticipantUpdate {
  user_id: string;
  username: string;
  display_name?: string;
  role: "host" | "speaker" | "listener";
  is_muted?: boolean;
  is_hand_raised?: boolean;
  is_video_on?: boolean;
  is_screen_sharing?: boolean;
}

export interface LiveRoomMessage {
  room_id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  content: string;
  timestamp: Date;
}

export interface ParticipantJoinedEvent {
  room_id: string;
  participant: LiveRoomParticipantUpdate;
  timestamp: Date;
}

export interface ParticipantLeftEvent {
  room_id: string;
  user_id: string;
  username?: string;
  timestamp: Date;
}

export interface ParticipantStateChangedEvent {
  room_id: string;
  user_id: string;
  is_muted?: boolean;
  is_video_on?: boolean;
  is_screen_sharing?: boolean;
  timestamp: Date;
}

export interface ParticipantHandRaisedEvent {
  room_id: string;
  user_id: string;
  is_hand_raised: boolean;
  timestamp: Date;
}

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
      withCredentials: true,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Connected:", this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      this.reconnectAttempts++;
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Subscribe to a market's updates
  subscribeToMarket(marketId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:market", marketId);
    }
  }

  unsubscribeFromMarket(marketId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:market", marketId);
    }
  }

  // Subscribe to an option's price updates
  subscribeToOption(optionId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:option", optionId);
    }
  }

  unsubscribeFromOption(optionId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:option", optionId);
    }
  }

  // Subscribe to global activity feed
  subscribeToActivity(): void {
    if (this.socket) {
      this.socket.emit("subscribe:activity");
    }
  }

  unsubscribeFromActivity(): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:activity");
    }
  }

  // Subscribe to user notifications
  subscribeToNotifications(userId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:notifications", userId);
    }
  }

  unsubscribeFromNotifications(userId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:notifications", userId);
    }
  }

  // Subscribe to user balance updates
  subscribeToBalance(userId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:balance", userId);
    }
  }

  unsubscribeFromBalance(userId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:balance", userId);
    }
  }

  // Subscribe to market comments
  subscribeToComments(marketId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:comments", marketId);
    }
  }

  unsubscribeFromComments(marketId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:comments", marketId);
    }
  }

  // Subscribe to a liveroom's updates
  subscribeToLiveroom(roomId: string): void {
    if (this.socket) {
      this.socket.emit("subscribe:liveroom", roomId);
    }
  }

  unsubscribeFromLiveroom(roomId: string): void {
    if (this.socket) {
      this.socket.emit("unsubscribe:liveroom", roomId);
    }
  }

  // Send liveroom chat message
  sendLiveroomMessage(roomId: string, userId: string, content: string): void {
    if (this.socket) {
      this.socket.emit("liveroom:message", { roomId, userId, content });
    }
  }

  // Send typing indicator
  sendLiveroomTyping(roomId: string, userId: string, username: string): void {
    if (this.socket) {
      this.socket.emit("liveroom:typing", { roomId, userId, username });
    }
  }

  // Event listeners
  onTrade(callback: (trade: TradeUpdate) => void): () => void {
    this.socket?.on("trade", callback);
    return () => this.socket?.off("trade", callback);
  }

  onPrice(callback: (update: PriceUpdate) => void): () => void {
    this.socket?.on("price", callback);
    return () => this.socket?.off("price", callback);
  }

  onMarket(callback: (update: MarketUpdate) => void): () => void {
    this.socket?.on("market", callback);
    return () => this.socket?.off("market", callback);
  }

  onActivity(callback: (activity: ActivityUpdate) => void): () => void {
    this.socket?.on("activity", callback);
    return () => this.socket?.off("activity", callback);
  }

  onNotification(callback: (notification: any) => void): () => void {
    this.socket?.on("notification", callback);
    return () => this.socket?.off("notification", callback);
  }

  onBalance(callback: (update: BalanceUpdate) => void): () => void {
    this.socket?.on("balance", callback);
    return () => this.socket?.off("balance", callback);
  }

  onComment(callback: (update: CommentUpdate) => void): () => void {
    this.socket?.on("comment", callback);
    return () => this.socket?.off("comment", callback);
  }

  // Liveroom event listeners
  onParticipantJoined(
    callback: (event: ParticipantJoinedEvent) => void
  ): () => void {
    this.socket?.on("participant:joined", callback);
    return () => this.socket?.off("participant:joined", callback);
  }

  onParticipantLeft(
    callback: (event: ParticipantLeftEvent) => void
  ): () => void {
    this.socket?.on("participant:left", callback);
    return () => this.socket?.off("participant:left", callback);
  }

  onParticipantStateChanged(
    callback: (event: ParticipantStateChangedEvent) => void
  ): () => void {
    this.socket?.on("participant:state_changed", callback);
    return () => this.socket?.off("participant:state_changed", callback);
  }

  onParticipantHandRaised(
    callback: (event: ParticipantHandRaisedEvent) => void
  ): () => void {
    this.socket?.on("participant:hand_raised", callback);
    return () => this.socket?.off("participant:hand_raised", callback);
  }

  onLiveroomMessage(callback: (message: LiveRoomMessage) => void): () => void {
    this.socket?.on("liveroom:message", callback);
    return () => this.socket?.off("liveroom:message", callback);
  }

  onLiveroomTyping(
    callback: (data: { user_id: string; username: string }) => void
  ): () => void {
    this.socket?.on("liveroom:typing", callback);
    return () => this.socket?.off("liveroom:typing", callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();
