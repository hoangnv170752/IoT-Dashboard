"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { websocketService } from "@/lib/websocket";
import { useAuth } from "@/contexts/auth-context";

interface WebSocketContextType {
  isConnected: boolean;
  notificationCount: number;
  subscribe: (type: string, handler: (data: unknown) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (user) {
      // Connect when user is authenticated
      websocketService.connect();

      // Subscribe to connection status changes
      const unsubscribeAll = websocketService.subscribe("*", () => {
        setIsConnected(websocketService.isConnected());
      });

      // Subscribe to notification count updates
      const unsubscribeNotifications = websocketService.subscribe(
        "notificationCount",
        (data) => {
          const message = data as { count?: number; notificationCount?: number };
          const count = message.count ?? message.notificationCount ?? 0;
          setNotificationCount(count);
        }
      );

      // Check connection status periodically
      const statusInterval = setInterval(() => {
        setIsConnected(websocketService.isConnected());
      }, 5000);

      return () => {
        unsubscribeAll();
        unsubscribeNotifications();
        clearInterval(statusInterval);
        websocketService.disconnect();
      };
    } else {
      // Disconnect when user logs out
      websocketService.disconnect();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsConnected(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotificationCount(0);
    }
  }, [user]);

  const subscribe = useCallback(
    (type: string, handler: (data: unknown) => void) => {
      return websocketService.subscribe(type, handler);
    },
    []
  );

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        notificationCount,
        subscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
