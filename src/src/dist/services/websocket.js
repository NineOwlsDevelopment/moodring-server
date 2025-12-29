"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomSize = exports.emitCommentUpdate = exports.getConnectedClients = exports.emitBalanceUpdate = exports.emitActivity = exports.emitNotification = exports.emitMarketUpdate = exports.emitPriceUpdate = exports.emitTradeUpdate = exports.getIO = exports.initializeWebSocket = void 0;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
const revocation_1 = require("../utils/revocation");
let io = null;
/**
 * Initialize WebSocket server
 */
const initializeWebSocket = (server) => {
    // Build allowed origins dynamically, similar to main CORS config
    const allowedOrigins = [
        process.env.CLIENT_URL || "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://moodring.io",
        "https://www.moodring.io",
        "http://moodring.io",
        "http://www.moodring.io",
    ];
    // Dynamic origin function for CORS - more flexible than static array
    const corsOrigin = (origin, callback) => {
        // Allow requests with no origin (like mobile apps or same-origin requests)
        if (!origin) {
            return callback(null, true);
        }
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // In development, be more permissive
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[WebSocket CORS] Allowing origin in development: ${origin}`);
            return callback(null, true);
        }
        // In production, log blocked origins for debugging
        console.warn(`[WebSocket CORS] Blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
    };
    io = new socket_io_1.Server(server, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST"],
            credentials: true,
        },
        // Allow both websocket and polling transports
        // Polling is essential as fallback when websocket upgrade fails behind proxies
        transports: ["websocket", "polling"],
        // Allow older Socket.IO clients (EIO3) for compatibility
        allowEIO3: true,
        // Increase ping timeout for production (helps with proxy delays)
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    io.on("connection", async (socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id}`);
        // Authenticate WebSocket connection
        // Check auth object, Authorization header, or cookies
        let token = socket.handshake.auth?.token ||
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
            }, {});
            token = cookies.accessToken;
        }
        if (token) {
            try {
                const payload = await (0, jwt_1.verifyAccessToken)(token);
                const isRevoked = await (0, revocation_1.isTokenRevoked)(token);
                if (!isRevoked) {
                    socket.userId = payload.id;
                    console.log(`[WebSocket] Client ${socket.id} authenticated as user ${payload.id}`);
                }
                else {
                    console.warn(`[WebSocket] Client ${socket.id} provided revoked token`);
                }
            }
            catch (error) {
                console.warn(`[WebSocket] Client ${socket.id} authentication failed:`, error);
            }
        }
        else {
            console.log(`[WebSocket] Client ${socket.id} connected without authentication (public access)`);
        }
        // Join market-specific rooms
        socket.on("subscribe:market", (marketId) => {
            socket.join(`market:${marketId}`);
            console.log(`[WebSocket] ${socket.id} subscribed to market:${marketId}`);
            // Emit watcher count update to all subscribers
            if (io) {
                const room = io.sockets.adapter.rooms.get(`market:${marketId}`);
                const watcherCount = room ? room.size : 0;
                io.to(`market:${marketId}`).emit("watchers", {
                    market_id: marketId,
                    count: watcherCount,
                    timestamp: new Date(),
                });
            }
        });
        socket.on("unsubscribe:market", (marketId) => {
            socket.leave(`market:${marketId}`);
            console.log(`[WebSocket] ${socket.id} unsubscribed from market:${marketId}`);
            // Emit watcher count update to all remaining subscribers
            if (io) {
                const room = io.sockets.adapter.rooms.get(`market:${marketId}`);
                const watcherCount = room ? room.size : 0;
                io.to(`market:${marketId}`).emit("watchers", {
                    market_id: marketId,
                    count: watcherCount,
                    timestamp: new Date(),
                });
            }
        });
        // Join option-specific rooms for price updates
        socket.on("subscribe:option", (optionId) => {
            socket.join(`option:${optionId}`);
            console.log(`[WebSocket] ${socket.id} subscribed to option:${optionId}`);
        });
        socket.on("unsubscribe:option", (optionId) => {
            socket.leave(`option:${optionId}`);
            console.log(`[WebSocket] ${socket.id} unsubscribed from option:${optionId}`);
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
        socket.on("subscribe:notifications", (userId) => {
            // Verify user can only subscribe to their own notifications
            if (!socket.userId || socket.userId !== userId) {
                console.warn(`[WebSocket] Unauthorized notification subscription attempt: ${socket.id} tried to subscribe to user ${userId}`);
                socket.emit("error", {
                    message: "Unauthorized: Cannot subscribe to other users' notifications",
                });
                return;
            }
            socket.join(`user:${userId}:notifications`);
            console.log(`[WebSocket] ${socket.id} subscribed to notifications for user:${userId}`);
        });
        socket.on("unsubscribe:notifications", (userId) => {
            if (!socket.userId || socket.userId !== userId) {
                return;
            }
            socket.leave(`user:${userId}:notifications`);
        });
        // User-specific balance updates (requires authentication)
        socket.on("subscribe:balance", (userId) => {
            // Verify user can only subscribe to their own balance updates
            if (!socket.userId || socket.userId !== userId) {
                console.warn(`[WebSocket] Unauthorized balance subscription attempt: ${socket.id} tried to subscribe to user ${userId}`);
                socket.emit("error", {
                    message: "Unauthorized: Cannot subscribe to other users' balance",
                });
                return;
            }
            socket.join(`user:${userId}:balance`);
            console.log(`[WebSocket] ${socket.id} subscribed to balance updates for user:${userId}`);
        });
        socket.on("unsubscribe:balance", (userId) => {
            if (!socket.userId || socket.userId !== userId) {
                return;
            }
            socket.leave(`user:${userId}:balance`);
        });
        // Subscribe to market comments
        socket.on("subscribe:comments", (marketId) => {
            socket.join(`comments:${marketId}`);
            console.log(`[WebSocket] ${socket.id} subscribed to comments:${marketId}`);
        });
        socket.on("unsubscribe:comments", (marketId) => {
            socket.leave(`comments:${marketId}`);
            console.log(`[WebSocket] ${socket.id} unsubscribed from comments:${marketId}`);
        });
        // Live room subscriptions
        socket.on("subscribe:liveroom", (roomId) => {
            socket.join(`liveroom:${roomId}`);
            console.log(`[WebSocket] ${socket.id} subscribed to liveroom:${roomId}`);
        });
        socket.on("unsubscribe:liveroom", (roomId) => {
            socket.leave(`liveroom:${roomId}`);
            console.log(`[WebSocket] ${socket.id} unsubscribed from liveroom:${roomId}`);
        });
        // Live room chat messages
        socket.on("liveroom:message", async (data) => {
            if (!io)
                return;
            // Verify user can only send messages as themselves
            if (!socket.userId || socket.userId !== data.userId) {
                console.warn(`[WebSocket] Unauthorized message attempt: ${socket.id} tried to send as user ${data.userId}`);
                socket.emit("error", {
                    message: "Unauthorized: Cannot send messages as another user",
                });
                return;
            }
            // Validate message content
            if (!data.content ||
                data.content.trim().length === 0 ||
                data.content.length > 1000) {
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
        });
        // Typing indicator for live room chat
        socket.on("liveroom:typing", (data) => {
            // Verify user can only send typing indicators as themselves
            if (!socket.userId || socket.userId !== data.userId) {
                return;
            }
            socket.to(`liveroom:${data.roomId}`).emit("liveroom:typing", {
                user_id: data.userId,
                username: data.username,
            });
        });
        socket.on("disconnect", () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
            // Update watcher counts for all markets this socket was watching
            const socketIO = io;
            if (!socketIO || !socket.rooms)
                return;
            socket.rooms.forEach((room) => {
                if (room.startsWith("market:")) {
                    const marketId = room.replace("market:", "");
                    const roomObj = socketIO.sockets.adapter.rooms.get(room);
                    const watcherCount = roomObj ? roomObj.size : 0;
                    socketIO.to(room).emit("watchers", {
                        market_id: marketId,
                        count: watcherCount,
                        timestamp: new Date(),
                    });
                }
            });
        });
    });
    console.log("[WebSocket] Server initialized");
    return io;
};
exports.initializeWebSocket = initializeWebSocket;
/**
 * Get the WebSocket server instance
 */
const getIO = () => io;
exports.getIO = getIO;
/**
 * Emit a trade update to subscribers
 */
const emitTradeUpdate = (trade) => {
    if (!io)
        return;
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
    });
};
exports.emitTradeUpdate = emitTradeUpdate;
/**
 * Emit a price update to subscribers
 */
const emitPriceUpdate = (update) => {
    if (!io)
        return;
    io.to(`option:${update.option_id}`).emit("price", update);
};
exports.emitPriceUpdate = emitPriceUpdate;
/**
 * Emit a market update to subscribers
 */
const emitMarketUpdate = (update) => {
    if (!io)
        return;
    io.to(`market:${update.market_id}`).emit("market", update);
    // Also emit to global activity for important events
    if (["created", "resolved"].includes(update.event)) {
        io.to("activity:global").emit("activity", {
            activity_type: `market_${update.event}`,
            entity_type: "market",
            entity_id: update.market_id,
            metadata: update.data,
            timestamp: update.timestamp,
        });
    }
};
exports.emitMarketUpdate = emitMarketUpdate;
/**
 * Emit a notification to a specific user
 */
const emitNotification = (userId, notification) => {
    if (!io)
        return;
    io.to(`user:${userId}:notifications`).emit("notification", notification);
};
exports.emitNotification = emitNotification;
/**
 * Emit an activity update to global subscribers
 */
const emitActivity = (activity) => {
    if (!io)
        return;
    io.to("activity:global").emit("activity", activity);
};
exports.emitActivity = emitActivity;
/**
 * Emit a balance update to a specific user
 */
const emitBalanceUpdate = (update) => {
    if (!io)
        return;
    io.to(`user:${update.user_id}:balance`).emit("balance", update);
};
exports.emitBalanceUpdate = emitBalanceUpdate;
/**
 * Get connected client count
 */
const getConnectedClients = () => {
    if (!io)
        return 0;
    return io.engine.clientsCount;
};
exports.getConnectedClients = getConnectedClients;
/**
 * Emit a comment update to subscribers
 */
const emitCommentUpdate = (update) => {
    if (!io)
        return;
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
        });
    }
};
exports.emitCommentUpdate = emitCommentUpdate;
/**
 * Get clients in a specific room
 */
const getRoomSize = async (room) => {
    if (!io)
        return 0;
    const sockets = await io.in(room).allSockets();
    return sockets.size;
};
exports.getRoomSize = getRoomSize;
//# sourceMappingURL=websocket.js.map