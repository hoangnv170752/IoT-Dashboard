import { prisma } from './prisma.js';
import { sendToUser, sendToTenant } from './websocket.js';
import { NotificationType, Prisma } from '@prisma/client';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  actionUrl?: string;
}

// Create and push notification to user
export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ?? Prisma.JsonNull,
      actionUrl: params.actionUrl,
    },
  });

  // Push via WebSocket
  sendToUser(params.userId, {
    type: 'notification',
    data: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    },
  });

  return notification;
}

// Create notification for all users in a tenant
export async function createTenantNotification(
  tenantId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Prisma.InputJsonValue,
  actionUrl?: string
) {
  // Get all users in tenant
  const users = await prisma.user.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true },
  });

  // Create notifications for all users
  const notifications = await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type,
      title,
      message,
      data: data ?? Prisma.JsonNull,
      actionUrl,
    })),
  });

  // Broadcast to tenant channel
  sendToTenant(tenantId, {
    type: 'tenant_notification',
    data: {
      type,
      title,
      message,
      data,
      actionUrl,
      createdAt: new Date().toISOString(),
    },
  });

  return notifications;
}

// Get unread notification count
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

// Mark notification as read
export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  });
}

// Mark all notifications as read
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

// Delete notification
export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
}

// Notification helpers for common events
export const NotificationHelpers = {
  // User invited to tenant
  async userInvited(userId: string, tenantName: string) {
    return createNotification({
      userId,
      type: 'info',
      title: 'Welcome!',
      message: `You have been added to ${tenantName}`,
      actionUrl: '/dashboard',
    });
  },

  // Contract status changed
  async contractStatusChanged(
    userId: string,
    contractNumber: string,
    newStatus: string,
    contractId: string
  ) {
    return createNotification({
      userId,
      type: 'info',
      title: 'Contract Updated',
      message: `Contract ${contractNumber} status changed to ${newStatus}`,
      data: { contractId, status: newStatus },
      actionUrl: `/contracts/${contractId}`,
    });
  },

  // Service ticket created
  async ticketCreated(
    userId: string,
    ticketNumber: string,
    ticketId: string
  ) {
    return createNotification({
      userId,
      type: 'info',
      title: 'New Support Ticket',
      message: `Ticket ${ticketNumber} has been created`,
      data: { ticketId },
      actionUrl: `/tickets/${ticketId}`,
    });
  },

  // Service ticket resolved
  async ticketResolved(
    userId: string,
    ticketNumber: string,
    ticketId: string
  ) {
    return createNotification({
      userId,
      type: 'success',
      title: 'Ticket Resolved',
      message: `Ticket ${ticketNumber} has been resolved`,
      data: { ticketId },
      actionUrl: `/tickets/${ticketId}`,
    });
  },

  // Device alert
  async deviceAlert(
    userId: string,
    deviceName: string,
    alertMessage: string,
    severity: 'info' | 'warning' | 'critical'
  ) {
    const typeMap: Record<string, NotificationType> = {
      info: 'info',
      warning: 'warning',
      critical: 'error',
    };

    return createNotification({
      userId,
      type: typeMap[severity] || 'alert',
      title: `Device Alert: ${deviceName}`,
      message: alertMessage,
      data: { deviceName, severity },
    });
  },

  // Subscription expiring
  async subscriptionExpiring(
    userId: string,
    daysRemaining: number,
    planName: string
  ) {
    return createNotification({
      userId,
      type: 'warning',
      title: 'Subscription Expiring',
      message: `Your ${planName} plan expires in ${daysRemaining} days`,
      actionUrl: '/billing',
    });
  },

  // Payment failed
  async paymentFailed(userId: string, amount: number, currency: string) {
    return createNotification({
      userId,
      type: 'error',
      title: 'Payment Failed',
      message: `We couldn't process your payment of ${amount} ${currency}`,
      actionUrl: '/billing',
    });
  },

  // Plan limit warning
  async planLimitWarning(
    userId: string,
    resource: string,
    current: number,
    limit: number
  ) {
    const percentage = Math.round((current / limit) * 100);
    return createNotification({
      userId,
      type: 'warning',
      title: 'Approaching Plan Limit',
      message: `You're using ${percentage}% of your ${resource} limit (${current}/${limit})`,
      actionUrl: '/billing',
    });
  },
};
