import { NotificationType, Prisma } from '@prisma/client';
interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Prisma.InputJsonValue;
    actionUrl?: string;
}
export declare function createNotification(params: CreateNotificationParams): Promise<{
    id: string;
    createdAt: Date;
    type: import("@prisma/client").$Enums.NotificationType;
    title: string;
    userId: string;
    message: string;
    data: Prisma.JsonValue | null;
    actionUrl: string | null;
    read: boolean;
    readAt: Date | null;
}>;
export declare function createTenantNotification(tenantId: string, type: NotificationType, title: string, message: string, data?: Prisma.InputJsonValue, actionUrl?: string): Promise<Prisma.BatchPayload>;
export declare function getUnreadCount(userId: string): Promise<number>;
export declare function markAsRead(notificationId: string, userId: string): Promise<Prisma.BatchPayload>;
export declare function markAllAsRead(userId: string): Promise<Prisma.BatchPayload>;
export declare function deleteNotification(notificationId: string, userId: string): Promise<Prisma.BatchPayload>;
export declare const NotificationHelpers: {
    userInvited(userId: string, tenantName: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    contractStatusChanged(userId: string, contractNumber: string, newStatus: string, contractId: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    ticketCreated(userId: string, ticketNumber: string, ticketId: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    ticketResolved(userId: string, ticketNumber: string, ticketId: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    deviceAlert(userId: string, deviceName: string, alertMessage: string, severity: "info" | "warning" | "critical"): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    subscriptionExpiring(userId: string, daysRemaining: number, planName: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    paymentFailed(userId: string, amount: number, currency: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
    planLimitWarning(userId: string, resource: string, current: number, limit: number): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        userId: string;
        message: string;
        data: Prisma.JsonValue | null;
        actionUrl: string | null;
        read: boolean;
        readAt: Date | null;
    }>;
};
export {};
//# sourceMappingURL=notifications.d.ts.map