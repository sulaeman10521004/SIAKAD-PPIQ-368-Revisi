import { requireVerifiedUser } from "@/lib/auth";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireVerifiedUser();
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(user.id, 10),
    getUnreadNotificationCount(user.id),
  ]);

  return Response.json(
    {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt.toISOString(),
        read: notification.readAt !== null,
        href: notification.href ?? "/notifikasi",
      })),
      unreadCount,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
