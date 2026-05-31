import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { JwtPayload } from './auth.js';
export declare function subscribe(socket: WebSocket, channel: string): void;
export declare function unsubscribe(socket: WebSocket, channel: string): void;
export declare function unsubscribeAll(socket: WebSocket): void;
export declare function broadcast(channel: string, message: Record<string, unknown>): void;
export declare function sendToUser(userId: string, message: Record<string, unknown>): void;
export declare function sendToTenant(tenantId: string, message: Record<string, unknown>): void;
export declare function registerUser(socket: WebSocket, user: JwtPayload): void;
export declare function unregisterUser(socket: WebSocket): void;
export declare function getSocketUser(socket: WebSocket): JwtPayload | undefined;
interface WsMessage {
    type: string;
    [key: string]: unknown;
}
type MessageHandler = (socket: WebSocket, message: WsMessage, user?: JwtPayload) => void | Promise<void>;
export declare function onMessage(type: string, handler: MessageHandler): void;
export declare function handleMessage(socket: WebSocket, rawMessage: string, fastify: FastifyInstance): Promise<void>;
export declare function setupWebSocket(fastify: FastifyInstance): Promise<void>;
export declare function getWebSocketStats(): {
    channels: number;
    uniqueUsers: number;
    totalConnections: number;
};
export {};
//# sourceMappingURL=websocket.d.ts.map