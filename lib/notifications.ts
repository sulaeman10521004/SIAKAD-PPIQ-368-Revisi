import { cache } from "react";
import { NotificationType, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  href?: string | null;
};

export const getUserNotifications = cache(async (userId: string, take = 50) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
});

export const getUnreadNotificationCount = cache(async (userId: string) => {
  return prisma.notification.count({ where: { userId, readAt: null } });
});

export async function notifyUsers(
  recipientIds: readonly string[],
  notification: NotificationInput,
  excludeUserId?: string,
): Promise<boolean> {
  const uniqueRecipients = Array.from(new Set(recipientIds)).filter((id) => id && id !== excludeUserId);
  if (uniqueRecipients.length === 0) return true;

  try {
    await prisma.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        href: notification.href ?? null,
      })),
    });
    return true;
  } catch (error) {
    console.error("Gagal membuat notifikasi aplikasi", error);
    return false;
  }
}

export async function notifyVerifiedRole(
  role: UserRole,
  notification: NotificationInput,
  excludeUserId?: string,
): Promise<boolean> {
  const recipients = await prisma.user.findMany({
    where: { roles: { has: role }, status: UserStatus.VERIFIED },
    select: { id: true },
  });

  return notifyUsers(recipients.map((recipient) => recipient.id), notification, excludeUserId);
}
