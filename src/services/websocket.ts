import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { isTokenRevoked } from "../utils/revocation";

// Extend Socket interface to include user data
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: Server | null = null;

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

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://moodring.io",
        "https://dev.moodring.io",
        "wss://dev.moodring.io",
        "ws://127.0.0.1:5173",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Authenticate WebSocket connection
    // Check auth object, Authorization header, or cookies
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    // If no token found, try to get from cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie
        .split(";")
        .reduce((acc, cookie) => {
          const parts = cookie.trim().split("=");
          if (parts.length === 2) {
            acc[parts[0]] = parts[1];
          }
          return acc;
        }, {} as Record<string, string>);
      token = cookies.accessToken;
    }

    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        const isRevoked = await isTokenRevoked(token);

        if (!isRevoked) {
          socket.userId = payload.id;
          console.log(
            `[WebSocket] Client ${socket.id} authenticated as user ${payload.id}`
          );
        } else {
          console.warn(
            `[WebSocket] Client ${socket.id} provided revoked token`
          );
        }
      } catch (error) {
        console.warn(
          `[WebSocket] Client ${socket.id} authentication failed:`,
          error
        );
      }
    } else {
      console.log(
        `[WebSocket] Client ${socket.id} connected without authentication (public access)`
      );
    }

    // Join market-specific rooms
    socket.on("subscribe:market", (marketId: string) => {
      socket.join(`market:${marketId}`);
      console.log(`[WebSocket] ${socket.id} subscribed to market:${marketId}`);
    });

    socket.on("unsubscribe:market", (marketId: string) => {
      socket.leave(`market:${marketId}`);
      console.log(
        `[WebSocket] ${socket.id} unsubscribed from market:${marketId}`
      );
    });

    // Join option-specific rooms for price updates
    socket.on("subscribe:option", (optionId: string) => {
      socket.join(`option:${optionId}`);
      console.log(`[WebSocket] ${socket.id} subscribed to option:${optionId}`);
    });

    socket.on("unsubscribe:option", (optionId: string) => {
      socket.leave(`option:${optionId}`);
      console.log(
        `[WebSocket] ${socket.id} unsubscribed from option:${optionId}`
      );
    });

    // Subscribe to global activity feed
    socket.on("subscribe:activity", () => {
      socket.join("activity:global");
      console.log(`[WebSocket] ${socket.id} subscribed to global activity`);
    });

    socket.on("unsubscribe:activity", () => {
      socket.leave("activity:global");
      console.log(`[WebSocket] ${socket.id} unsubscribed from global activity`);
    });

    // User-specific notifications (requires authentication)
    socket.on("subscribe:notifications", (userId: string) => {
      // Verify user can only subscribe to their own notifications
      if (!socket.userId || socket.userId !== userId) {
        console.warn(
          `[WebSocket] Unauthorized notification subscription attempt: ${socket.id} tried to subscribe to user ${userId}`
        );
        socket.emit("error", {
          message:
            "Unauthorized: Cannot subscribe to other users' notifications",
        });
        return;
      }

      socket.join(`user:${userId}:notifications`);
      console.log(
        `[WebSocket] ${socket.id} subscribed to notifications for user:${userId}`
      );
    });

    socket.on("unsubscribe:notifications", (userId: string) => {
      if (!socket.userId || socket.userId !== userId) {
        return;
      }
      socket.leave(`user:${userId}:notifications`);
    });

    // User-specific balance updates (requires authentication)
    socket.on("subscribe:balance", (userId: string) => {
      // Verify user can only subscribe to their own balance updates
      if (!socket.userId || socket.userId !== userId) {
        console.warn(
          `[WebSocket] Unauthorized balance subscription attempt: ${socket.id} tried to subscribe to user ${userId}`
        );
        socket.emit("error", {
          message: "Unauthorized: Cannot subscribe to other users' balance",
        });
        return;
      }

      socket.join(`user:${userId}:balance`);
      console.log(
        `[WebSocket] ${socket.id} subscribed to balance updates for user:${userId}`
      );
    });

    socket.on("unsubscribe:balance", (userId: string) => {
      if (!socket.userId || socket.userId !== userId) {
        return;
      }
      socket.leave(`user:${userId}:balance`);
    });

    // Subscribe to market comments
    socket.on("subscribe:comments", (marketId: string) => {
      socket.join(`comments:${marketId}`);
      console.log(
        `[WebSocket] ${socket.id} subscribed to comments:${marketId}`
      );
    });

    socket.on("unsubscribe:comments", (marketId: string) => {
      socket.leave(`comments:${marketId}`);
      console.log(
        `[WebSocket] ${socket.id} unsubscribed from comments:${marketId}`
      );
    });

    // Live room subscriptions
    socket.on("subscribe:liveroom", (roomId: string) => {
      socket.join(`liveroom:${roomId}`);
      console.log(`[WebSocket] ${socket.id} subscribed to liveroom:${roomId}`);
    });

    socket.on("unsubscribe:liveroom", (roomId: string) => {
      socket.leave(`liveroom:${roomId}`);
      console.log(
        `[WebSocket] ${socket.id} unsubscribed from liveroom:${roomId}`
      );
    });

    // Live room chat messages
    socket.on(
      "liveroom:message",
      async (data: { roomId: string; content: string; userId: string }) => {
        if (!io) return;

        // Verify user can only send messages as themselves
        if (!socket.userId || socket.userId !== data.userId) {
          console.warn(
            `[WebSocket] Unauthorized message attempt: ${socket.id} tried to send as user ${data.userId}`
          );
          socket.emit("error", {
            message: "Unauthorized: Cannot send messages as another user",
          });
          return;
        }

        // Validate message content
        if (
          !data.content ||
          data.content.trim().length === 0 ||
          data.content.length > 1000
        ) {
          socket.emit("error", { message: "Invalid message content" });
          return;
        }

        // Broadcast message to room
        io.to(`liveroom:${data.roomId}`).emit("liveroom:message", {
          room_id: data.roomId,
          user_id: data.userId,
          content: data.content.trim(),
          timestamp: new Date(),
        });
      }
    );

    // Typing indicator for live room chat
    socket.on(
      "liveroom:typing",
      (data: { roomId: string; userId: string; username: string }) => {
        // Verify user can only send typing indicators as themselves
        if (!socket.userId || socket.userId !== data.userId) {
          return;
        }

        socket.to(`liveroom:${data.roomId}`).emit("liveroom:typing", {
          user_id: data.userId,
          username: data.username,
        });
      }
    );

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[WebSocket] Server initialized");
  return io;
};

/**
 * Get the WebSocket server instance
 */
export const getIO = (): Server | null => io;

/**
 * Emit a trade update to subscribers
 */
export const emitTradeUpdate = (trade: TradeUpdate): void => {
  if (!io) return;

  // Emit to market room
  io.to(`market:${trade.market_id}`).emit("trade", trade);

  // Emit to option room
  io.to(`option:${trade.option_id}`).emit("trade", trade);

  // Emit to global activity
  io.to("activity:global").emit("activity", {
    activity_type: "trade",
    entity_type: "option",
    entity_id: trade.option_id,
    metadata: trade,
    timestamp: trade.timestamp,
  } as ActivityUpdate);
};

/**
 * Emit a price update to subscribers
 */
export const emitPriceUpdate = (update: PriceUpdate): void => {
  if (!io) return;

  io.to(`option:${update.option_id}`).emit("price", update);
};

/**
 * Emit a market update to subscribers
 */
export const emitMarketUpdate = (update: MarketUpdate): void => {
  if (!io) return;

  io.to(`market:${update.market_id}`).emit("market", update);

  // Also emit to global activity for important events
  if (["created", "resolved"].includes(update.event)) {
    io.to("activity:global").emit("activity", {
      activity_type: `market_${update.event}`,
      entity_type: "market",
      entity_id: update.market_id,
      metadata: update.data,
      timestamp: update.timestamp,
    } as ActivityUpdate);
  }
};

/**
 * Emit a notification to a specific user
 */
export const emitNotification = (userId: string, notification: any): void => {
  if (!io) return;

  io.to(`user:${userId}:notifications`).emit("notification", notification);
};

/**
 * Emit an activity update to global subscribers
 */
export const emitActivity = (activity: ActivityUpdate): void => {
  if (!io) return;

  io.to("activity:global").emit("activity", activity);
};

/**
 * Emit a balance update to a specific user
 */
export const emitBalanceUpdate = (update: BalanceUpdate): void => {
  if (!io) return;

  io.to(`user:${update.user_id}:balance`).emit("balance", update);
};

/**
 * Get connected client count
 */
export const getConnectedClients = (): number => {
  if (!io) return 0;
  return io.engine.clientsCount;
};

/**
 * Emit a comment update to subscribers
 */
export const emitCommentUpdate = (update: CommentUpdate): void => {
  if (!io) return;

  // Emit to market comments room
  io.to(`comments:${update.market_id}`).emit("comment", update);

  // Also emit to global activity for new comments
  if (update.event === "created") {
    io.to("activity:global").emit("activity", {
      activity_type: "comment",
      entity_type: "comment",
      entity_id: update.comment_id,
      metadata: {
        market_id: update.market_id,
        is_reply: !!update.parent_id,
      },
      timestamp: update.timestamp,
    } as ActivityUpdate);
  }
};

/**
 * Get clients in a specific room
 */
export const getRoomSize = async (room: string): Promise<number> => {
  if (!io) return 0;
  const sockets = await io.in(room).allSockets();
  return sockets.size;
};
