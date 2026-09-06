import { requireVerifiedUser } from "@/lib/auth";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";
import { NotificationCenter } from "./NotificationCenter";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default async function NotifikasiPage() {
  const user = await requireVerifiedUser();
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(user.id, 50),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <NotificationCenter
      items={notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        href: notification.href ?? "/dashboard",
        createdAt: dateFmt.format(notification.createdAt),
        read: notification.readAt !== null,
      }))}
      unreadCount={unreadCount}
    />
  );
}
