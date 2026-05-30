import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { JwtPayload } from './auth.js';

// Connection storage
const connections = new Map<string, Set<WebSocket>>();
const userConnections = new Map<string, Set<WebSocket>>();
const socketUsers = new Map<WebSocket, JwtPayload>();

// Channel types
type ChannelType = 'notifications' | 'chat' | 'tenant';

function getChannelKey(type: ChannelType, id?: string): string {
  if (type === 'notifications') return 'notifications';
  return `${type}:${id}`;
}

// Subscribe to a channel
export function subscribe(socket: WebSocket, channel: string) {
  if (!connections.has(channel)) {
    connections.set(channel, new Set());
  }
  connections.get(channel)!.add(socket);
}

// Unsubscribe from a channel
export function unsubscribe(socket: WebSocket, channel: string) {
  connections.get(channel)?.delete(socket);
}

// Unsubscribe from all channels
export function unsubscribeAll(socket: WebSocket) {
  for (const [channel, sockets] of connections) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      connections.delete(channel);
    }
  }
}

// Send to a specific channel
export function broadcast(channel: string, message: Record<string, unknown>) {
  const sockets = connections.get(channel);
  if (!sockets) return;

  const data = JSON.stringify(message);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

// Send to a specific user
export function sendToUser(userId: string, message: Record<string, unknown>) {
  const sockets = userConnections.get(userId);
  if (!sockets) return;

  const data = JSON.stringify(message);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

// Send to all users in a tenant
export function sendToTenant(tenantId: string, message: Record<string, unknown>) {
  broadcast(`tenant:${tenantId}`, message);
}

// Register user connection
export function registerUser(socket: WebSocket, user: JwtPayload) {
  socketUsers.set(socket, user);

  // Add to user connections
  if (!userConnections.has(user.userId)) {
    userConnections.set(user.userId, new Set());
  }
  userConnections.get(user.userId)!.add(socket);

  // Auto-subscribe to user's notification channel
  subscribe(socket, 'notifications');

  // Auto-subscribe to tenant channel if applicable
  if (user.tenantId) {
    subscribe(socket, `tenant:${user.tenantId}`);
  }
}

// Unregister user connection
export function unregisterUser(socket: WebSocket) {
  const user = socketUsers.get(socket);
  if (user) {
    userConnections.get(user.userId)?.delete(socket);
    if (userConnections.get(user.userId)?.size === 0) {
      userConnections.delete(user.userId);
    }
  }
  socketUsers.delete(socket);
  unsubscribeAll(socket);
}

// Get user from socket
export function getSocketUser(socket: WebSocket): JwtPayload | undefined {
  return socketUsers.get(socket);
}

// Message types
interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface AuthMessage extends WsMessage {
  type: 'auth';
  token: string;
}

interface SubscribeMessage extends WsMessage {
  type: 'subscribe';
  channel: string;
}

interface UnsubscribeMessage extends WsMessage {
  type: 'unsubscribe';
  channel: string;
}

interface ChatMessage extends WsMessage {
  type: 'chat_message';
  sessionId: string;
  content: string;
}

// Message handler type
type MessageHandler = (socket: WebSocket, message: WsMessage, user?: JwtPayload) => void | Promise<void>;

const messageHandlers = new Map<string, MessageHandler>();

// Register message handler
export function onMessage(type: string, handler: MessageHandler) {
  messageHandlers.set(type, handler);
}

// Process incoming message
export async function handleMessage(
  socket: WebSocket,
  rawMessage: string,
  fastify: FastifyInstance
) {
  let message: WsMessage;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  const user = getSocketUser(socket);

  // Handle authentication
  if (message.type === 'auth') {
    const authMessage = message as AuthMessage;
    try {
      const decoded = fastify.jwt.verify<JwtPayload>(authMessage.token);
      registerUser(socket, decoded);
      socket.send(JSON.stringify({
        type: 'auth_success',
        userId: decoded.userId,
        role: decoded.role,
        tenantId: decoded.tenantId,
      }));
    } catch {
      socket.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
    }
    return;
  }

  // Require authentication for other messages
  if (!user) {
    socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }

  // Handle subscribe
  if (message.type === 'subscribe') {
    const subMessage = message as SubscribeMessage;
    // Validate channel access
    if (canAccessChannel(user, subMessage.channel)) {
      subscribe(socket, subMessage.channel);
      socket.send(JSON.stringify({ type: 'subscribed', channel: subMessage.channel }));
    } else {
      socket.send(JSON.stringify({ type: 'error', message: 'Channel access denied' }));
    }
    return;
  }

  // Handle unsubscribe
  if (message.type === 'unsubscribe') {
    const unsubMessage = message as UnsubscribeMessage;
    unsubscribe(socket, unsubMessage.channel);
    socket.send(JSON.stringify({ type: 'unsubscribed', channel: unsubMessage.channel }));
    return;
  }

  // Delegate to registered handlers
  const handler = messageHandlers.get(message.type);
  if (handler) {
    try {
      await handler(socket, message, user);
    } catch (error) {
      console.error(`Error handling message type ${message.type}:`, error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Handler error',
      }));
    }
  } else {
    socket.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${message.type}` }));
  }
}

// Channel access control
function canAccessChannel(user: JwtPayload, channel: string): boolean {
  // SysAdmin can access all channels
  if (user.role === 'sys_admin') return true;

  // Parse channel
  const [type, id] = channel.split(':');

  // Notifications channel - all authenticated users
  if (channel === 'notifications') return true;

  // Chat sessions - check ownership
  if (type === 'chat') {
    // TODO: Check if user owns this session
    return true;
  }

  // Tenant channels - must be in that tenant
  if (type === 'tenant') {
    return user.tenantId === id;
  }

  return false;
}

// Setup WebSocket routes
export async function setupWebSocket(fastify: FastifyInstance) {
  await fastify.register(import('@fastify/websocket'));

  fastify.get('/ws', { websocket: true }, (socket, request) => {
    console.log('WebSocket client connected');

    // Send connection acknowledgment
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to CRM WebSocket server',
    }));

    // Handle incoming messages
    socket.on('message', async (data) => {
      await handleMessage(socket, data.toString(), fastify);
    });

    // Handle disconnection
    socket.on('close', () => {
      console.log('WebSocket client disconnected');
      unregisterUser(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      unregisterUser(socket);
    });
  });
}

// Stats for monitoring
export function getWebSocketStats() {
  let totalConnections = 0;
  for (const sockets of connections.values()) {
    totalConnections += sockets.size;
  }

  return {
    channels: connections.size,
    uniqueUsers: userConnections.size,
    totalConnections,
  };
}
