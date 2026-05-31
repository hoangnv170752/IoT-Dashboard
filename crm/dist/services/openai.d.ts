import { WebSocket } from 'ws';
import { JwtPayload } from './auth.js';
export declare function processChat(socket: WebSocket, sessionId: string | null, content: string, user: JwtPayload): Promise<void>;
export declare function setupChatHandler(): void;
export declare function chatCompletion(sessionId: string | null, content: string, user: JwtPayload): Promise<{
    sessionId: string;
    response: string;
    messageId: string;
}>;
//# sourceMappingURL=openai.d.ts.map