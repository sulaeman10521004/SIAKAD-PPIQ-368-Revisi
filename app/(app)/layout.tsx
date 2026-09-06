import { requireVerifiedUser } from "@/lib/auth";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";
import { Shell } from "./_components/Shell";
import type { Role } from "./_components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireVerifiedUser();
  const [notificationRows, unreadNotificationCount] = await Promise.all([
    getUserNotifications(user.id, 10),
    getUnreadNotificationCount(user.id),
  ]);
  const notifications = notificationRows.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    createdAt: notification.createdAt.toISOString(),
    read: notification.readAt !== null,
    href: notification.href ?? "/notifikasi",
  }));

  return (
    <Shell
      user={{ name: user.name, email: user.email, roles: user.roles as Role[] }}
      notifications={notifications}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </Shell>
  );
}
