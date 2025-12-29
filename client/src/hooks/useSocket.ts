import { useEffect, useRef, useState } from "react";
import {
  socketService,
  TradeUpdate,
  PriceUpdate,
  MarketUpdate,
  ActivityUpdate,
  CommentUpdate,
  WatcherUpdate,
} from "@/services/socket";

/**
 * Hook to manage socket connection lifecycle
 */
export function useSocketConnection() {
  useEffect(() => {
    socketService.connect();
    return () => {
      // Don't disconnect on unmount - let the service manage connection
    };
  }, []);

  return {
    isConnected: socketService.isConnected(),
    socket: socketService.getSocket(),
  };
}

/**
 * Hook to subscribe to a market's real-time updates
 */
export function useMarketSocket(
  marketId: string | undefined,
  callbacks: {
    onTrade?: (trade: TradeUpdate) => void;
    onMarket?: (update: MarketUpdate) => void;
  } = {}
) {
  const { onTrade, onMarket } = callbacks;

  useEffect(() => {
    if (!marketId) return;

    // Ensure connected
    socketService.connect();

    // Subscribe to market
    socketService.subscribeToMarket(marketId);

    // Set up listeners
    const unsubTrade = onTrade ? socketService.onTrade(onTrade) : undefined;
    const unsubMarket = onMarket ? socketService.onMarket(onMarket) : undefined;

    return () => {
      socketService.unsubscribeFromMarket(marketId);
      unsubTrade?.();
      unsubMarket?.();
    };
  }, [marketId, onTrade, onMarket]);
}

/**
 * Hook to subscribe to option price updates
 */
export function useOptionSocket(
  optionIds: string[],
  callbacks: {
    onPrice?: (update: PriceUpdate) => void;
    onTrade?: (trade: TradeUpdate) => void;
  } = {}
) {
  const { onPrice, onTrade } = callbacks;
  const subscribedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (optionIds.length === 0) return;

    // Ensure connected
    socketService.connect();

    // Subscribe to new options
    optionIds.forEach((id) => {
      if (!subscribedIds.current.has(id)) {
        socketService.subscribeToOption(id);
        subscribedIds.current.add(id);
      }
    });

    // Unsubscribe from removed options
    subscribedIds.current.forEach((id) => {
      if (!optionIds.includes(id)) {
        socketService.unsubscribeFromOption(id);
        subscribedIds.current.delete(id);
      }
    });

    // Set up listeners
    const unsubPrice = onPrice ? socketService.onPrice(onPrice) : undefined;
    const unsubTrade = onTrade ? socketService.onTrade(onTrade) : undefined;

    return () => {
      subscribedIds.current.forEach((id) => {
        socketService.unsubscribeFromOption(id);
      });
      subscribedIds.current.clear();
      unsubPrice?.();
      unsubTrade?.();
    };
  }, [optionIds.join(","), onPrice, onTrade]);
}

/**
 * Hook to subscribe to global activity feed
 */
export function useActivitySocket(
  onActivity: (activity: ActivityUpdate) => void
) {
  useEffect(() => {
    socketService.connect();
    socketService.subscribeToActivity();

    const unsub = socketService.onActivity(onActivity);

    return () => {
      socketService.unsubscribeFromActivity();
      unsub();
    };
  }, [onActivity]);
}

/**
 * Hook to subscribe to user notifications
 */
export function useNotificationSocket(
  userId: string | undefined,
  onNotification: (notification: any) => void
) {
  useEffect(() => {
    if (!userId) return;

    socketService.connect();
    socketService.subscribeToNotifications(userId);

    const unsub = socketService.onNotification(onNotification);

    return () => {
      socketService.unsubscribeFromNotifications(userId);
      unsub();
    };
  }, [userId, onNotification]);
}

/**
 * Hook to subscribe to market comments
 */
export function useCommentSocket(
  marketId: string | undefined,
  callbacks: {
    onComment?: (update: CommentUpdate) => void;
  } = {}
) {
  const { onComment } = callbacks;

  useEffect(() => {
    if (!marketId) return;

    // Ensure connected
    socketService.connect();

    // Subscribe to comments
    socketService.subscribeToComments(marketId);

    // Set up listener
    const unsubComment = onComment
      ? socketService.onComment(onComment)
      : undefined;

    return () => {
      socketService.unsubscribeFromComments(marketId);
      unsubComment?.();
    };
  }, [marketId, onComment]);
}

/**
 * Hook to track watchers for a market
 */
export function useMarketWatchers(
  marketId: string | undefined,
  onWatchers?: (count: number) => void
) {
  const [watcherCount, setWatcherCount] = useState<number>(0);

  useEffect(() => {
    if (!marketId) return;

    // Ensure connected
    socketService.connect();

    // Subscribe to market (this will trigger watcher count)
    socketService.subscribeToMarket(marketId);

    // Set up watcher listener
    const unsubWatchers = socketService.onWatchers((update: WatcherUpdate) => {
      if (update.market_id === marketId) {
        setWatcherCount(update.count);
        if (onWatchers) {
          onWatchers(update.count);
        }
      }
    });

    return () => {
      socketService.unsubscribeFromMarket(marketId);
      unsubWatchers();
    };
  }, [marketId, onWatchers]);

  return watcherCount;
}
