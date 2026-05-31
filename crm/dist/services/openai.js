import OpenAI from 'openai';
import { prisma } from './prisma.js';
import { onMessage, subscribe } from './websocket.js';
import { Prisma } from '@prisma/client';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';
// System prompt for the IoT assistant
const SYSTEM_PROMPT = `You are an AI assistant for an IoT Dashboard CRM platform. You help users with:

1. **Device Management**: Understanding device status, telemetry data, and alerts
2. **CRM Operations**: Managing companies, contacts, deals, and contracts
3. **Support Tickets**: Creating and tracking service tickets
4. **Analytics**: Interpreting device data and performance metrics
5. **Platform Usage**: Navigating features and best practices

Guidelines:
- Be concise and helpful
- When discussing devices, reference their names and types
- Suggest relevant actions when appropriate
- If you need more context, ask clarifying questions
- Format responses with markdown for readability

You have access to the user's tenant data and can help analyze their IoT deployments.`;
// Build context for the assistant
async function buildContext(user) {
    if (!user.tenantId) {
        return 'User is a system administrator with platform-wide access.';
    }
    // Fetch relevant tenant data
    const [deviceCount, companyCount, openTickets, recentAlerts] = await Promise.all([
        prisma.deviceAssignment.count({ where: { tenantId: user.tenantId } }),
        prisma.company.count({ where: { tenantId: user.tenantId } }),
        prisma.serviceTicket.count({
            where: {
                deviceAssignment: { tenantId: user.tenantId },
                status: { in: ['open', 'in_progress'] },
            },
        }),
        prisma.alertHistory.findMany({
            where: {
                alertRule: { tenantId: user.tenantId },
                acknowledged: false,
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
        }),
    ]);
    let context = `Current tenant context:
- Total devices: ${deviceCount}
- Total companies: ${companyCount}
- Open support tickets: ${openTickets}`;
    if (recentAlerts.length > 0) {
        context += `\n- Recent unacknowledged alerts:\n`;
        for (const alert of recentAlerts) {
            context += `  - ${alert.deviceName}: ${alert.message} (${alert.severity})\n`;
        }
    }
    return context;
}
// Get or create chat session
async function getOrCreateSession(sessionId, user) {
    if (sessionId) {
        const existing = await prisma.chatSession.findUnique({
            where: { id: sessionId },
        });
        if (existing)
            return existing.id;
    }
    // Create new session
    const session = await prisma.chatSession.create({
        data: {
            userEmail: user.email,
            tenantId: user.tenantId,
            title: 'New Conversation',
        },
    });
    return session.id;
}
// Get conversation history
async function getConversationHistory(sessionId) {
    const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20, // Limit context window
    });
    return messages.map((m) => ({
        role: m.role,
        content: m.content,
    }));
}
// Save message to database
async function saveMessage(sessionId, role, content, metadata) {
    return prisma.chatMessage.create({
        data: {
            sessionId,
            role,
            content,
            metadata: metadata ?? Prisma.JsonNull,
        },
    });
}
// Update session title based on first message
async function updateSessionTitle(sessionId, firstMessage) {
    // Generate title from first message (truncate to 50 chars)
    const title = firstMessage.length > 50
        ? firstMessage.substring(0, 47) + '...'
        : firstMessage;
    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
    });
}
// Process chat message with streaming
export async function processChat(socket, sessionId, content, user) {
    try {
        // Get or create session
        const actualSessionId = await getOrCreateSession(sessionId, user);
        // Subscribe to chat channel
        subscribe(socket, `chat:${actualSessionId}`);
        // Build context
        const context = await buildContext(user);
        // Get conversation history
        const history = await getConversationHistory(actualSessionId);
        // Check if this is first message and update title
        if (history.length === 0) {
            await updateSessionTitle(actualSessionId, content);
        }
        // Save user message
        await saveMessage(actualSessionId, 'user', content);
        // Build messages array
        const messages = [
            { role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` },
            ...history,
            { role: 'user', content },
        ];
        // Stream response
        const stream = await openai.chat.completions.create({
            model: MODEL,
            messages,
            stream: true,
            max_tokens: 1000,
        });
        let fullResponse = '';
        // Send session ID first
        socket.send(JSON.stringify({
            type: 'chat_session',
            sessionId: actualSessionId,
        }));
        // Stream chunks
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                socket.send(JSON.stringify({
                    type: 'chat_stream',
                    sessionId: actualSessionId,
                    chunk: content,
                }));
            }
        }
        // Save assistant message
        const assistantMessage = await saveMessage(actualSessionId, 'assistant', fullResponse, {
            model: MODEL,
            promptTokens: messages.reduce((acc, m) => acc + (m.content?.length || 0), 0),
        });
        // Send completion
        socket.send(JSON.stringify({
            type: 'chat_complete',
            sessionId: actualSessionId,
            messageId: assistantMessage.id,
        }));
    }
    catch (error) {
        console.error('Chat error:', error);
        socket.send(JSON.stringify({
            type: 'chat_error',
            message: error instanceof Error ? error.message : 'Failed to process message',
        }));
    }
}
// Register chat message handler
export function setupChatHandler() {
    onMessage('chat_message', async (socket, message, user) => {
        if (!user) {
            socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
        }
        const chatMessage = message;
        if (!chatMessage.content || typeof chatMessage.content !== 'string') {
            socket.send(JSON.stringify({ type: 'error', message: 'Content is required' }));
            return;
        }
        await processChat(socket, chatMessage.sessionId || null, chatMessage.content, user);
    });
}
// Non-streaming chat for REST API
export async function chatCompletion(sessionId, content, user) {
    // Get or create session
    const actualSessionId = await getOrCreateSession(sessionId, user);
    // Build context
    const context = await buildContext(user);
    // Get conversation history
    const history = await getConversationHistory(actualSessionId);
    // Update title if first message
    if (history.length === 0) {
        await updateSessionTitle(actualSessionId, content);
    }
    // Save user message
    await saveMessage(actualSessionId, 'user', content);
    // Build messages array
    const messages = [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` },
        ...history,
        { role: 'user', content },
    ];
    // Get completion
    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: 1000,
    });
    const response = completion.choices[0]?.message?.content || '';
    // Save assistant message
    const assistantMessage = await saveMessage(actualSessionId, 'assistant', response, {
        model: MODEL,
        usage: completion.usage ? JSON.parse(JSON.stringify(completion.usage)) : null,
    });
    return {
        sessionId: actualSessionId,
        response,
        messageId: assistantMessage.id,
    };
}
//# sourceMappingURL=openai.js.map