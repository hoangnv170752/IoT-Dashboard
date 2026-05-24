import { getToken } from "./auth";

function getWebSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  // Convert https://domain/api to wss://domain/api/ws
  // Convert http://domain/api to ws://domain/api/ws
  return apiUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/ws";
}

export interface WebSocketMessage {
  cmds?: WebSocketCommand[];
  authCmd?: AuthCommand;
}

export interface WebSocketCommand {
  type: string;
  cmdId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AuthCommand {
  cmdId: number;
  token: string;
}

export interface NotificationCountUpdate {
  cmdId: number;
  count: number;
}

type MessageHandler = (data: unknown) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private cmdId = 0;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;

  connect(): void {
    // Only run on client side
    if (typeof window === "undefined") {
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn("WebSocket: No token available, skipping connection");
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = getWebSocketUrl();
      console.log("WebSocket: Connecting to", wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Send auth command and subscribe to notifications
        this.sendAuthAndSubscribe(token);

        // Start ping interval to keep connection alive
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("WebSocket: Failed to parse message", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason || "none"}, wasClean=${event.wasClean}`);
        this.isConnecting = false;
        this.stopPingInterval();
        // Only attempt reconnect if not a clean close
        if (!event.wasClean && event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        // WebSocket error events don't contain useful info in browsers
        // The actual error will be logged in onclose
        console.warn("WebSocket: Connection error occurred");
        this.isConnecting = false;
      };
    } catch (error) {
      console.error("WebSocket: Failed to create connection", error);
      this.isConnecting = false;
    }
  }

  private sendAuthAndSubscribe(token: string): void {
    const message: WebSocketMessage = {
      authCmd: {
        cmdId: this.getNextCmdId(),
        token: token,
      },
      cmds: [
        {
          type: "NOTIFICATIONS_COUNT",
          cmdId: this.getNextCmdId(),
        },
      ],
    };

    this.send(message);
  }

  private getNextCmdId(): number {
    return this.cmdId++;
  }

  private handleMessage(data: unknown): void {
    // Emit to all registered handlers
    this.messageHandlers.forEach((handlers, type) => {
      if (type === "*") {
        handlers.forEach((handler) => handler(data));
      }
    });

    // Handle specific message types
    if (typeof data === "object" && data !== null) {
      const message = data as Record<string, unknown>;

      // Notification count update
      if ("notificationCount" in message || "count" in message) {
        const handlers = this.messageHandlers.get("notificationCount");
        handlers?.forEach((handler) => handler(message));
      }

      // Handle other message types as needed
      if ("update" in message) {
        const handlers = this.messageHandlers.get("update");
        handlers?.forEach((handler) => handler(message));
      }
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // ThingsBoard doesn't require explicit ping, but we can send an empty command
        // to keep the connection alive if needed
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("WebSocket: Max reconnection attempts reached");
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn("WebSocket: No token available for reconnection");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `WebSocket: Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket: Cannot send message, connection not open");
    }
  }

  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
