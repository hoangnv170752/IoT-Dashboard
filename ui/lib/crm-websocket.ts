// CRM WebSocket Service for real-time chat
const CRM_WS_URL = process.env.NEXT_PUBLIC_CRM_WS_URL || 'ws://localhost:5001/ws';

export interface CrmWsMessage {
  type: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

type MessageHandler = (data: CrmWsMessage) => void;

class CrmWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private token: string | null = null;
  private isAuthenticated = false;
  private pendingMessages: CrmWsMessage[] = [];

  connect(token: string): void {
    if (typeof window === 'undefined') return;

    this.token = token;

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log('CRM WebSocket: Connecting to', CRM_WS_URL);
      this.ws = new WebSocket(CRM_WS_URL);

      this.ws.onopen = () => {
        console.log('CRM WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Authenticate
        this.send({ type: 'auth', token: this.token });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CrmWsMessage;
          this.handleMessage(data);
        } catch (error) {
          console.error('CRM WebSocket: Failed to parse message', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`CRM WebSocket closed: code=${event.code}`);
        this.isConnecting = false;
        this.isAuthenticated = false;
        if (!event.wasClean && event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        console.warn('CRM WebSocket: Connection error');
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('CRM WebSocket: Failed to create connection', error);
      this.isConnecting = false;
    }
  }

  private handleMessage(data: CrmWsMessage): void {
    // Handle auth success
    if (data.type === 'auth_success') {
      console.log('CRM WebSocket: Authenticated');
      this.isAuthenticated = true;
      // Send any pending messages
      this.pendingMessages.forEach(msg => this.send(msg));
      this.pendingMessages = [];
    }

    // Emit to specific type handlers
    const handlers = this.messageHandlers.get(data.type);
    handlers?.forEach(handler => handler(data));

    // Emit to wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    wildcardHandlers?.forEach(handler => handler(data));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.token) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`CRM WebSocket: Reconnecting ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  send(message: CrmWsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else if (message.type !== 'auth') {
      // Queue non-auth messages
      this.pendingMessages.push(message);
    }
  }

  // Subscribe to a channel
  subscribeChannel(channel: string): void {
    this.send({ type: 'subscribe', channel });
  }

  // Send chat message
  sendChatMessage(sessionId: string, content: string): void {
    this.send({
      type: 'chat_message',
      sessionId,
      content,
    });
  }

  // Subscribe to message type
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  // Remove all handlers for a type
  off(type: string): void {
    this.messageHandlers.delete(type);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

// Singleton
export const crmWebSocket = new CrmWebSocketService();
