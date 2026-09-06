"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Icons, initialsFromName } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { sortRoles } from "@/lib/permissions";
import { markAllNotificationsReadAction } from "../notifikasi/actions";
import { pageTitleFor, ROLE_LABEL, type Role } from "./nav";

export type AppNotification = {
  id: string;
  type: "ADMISSION" | "REPORT" | "SCHEDULE" | "SYSTEM";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href: string;
};

const notificationDateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function Topbar({
  user,
  notifications,
  unreadNotificationCount,
  onMenu,
}: {
  user: { name: string; email: string; roles: Role[] };
  notifications: AppNotification[];
  unreadNotificationCount: number;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [unreadCount, setUnreadCount] = useState(unreadNotificationCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>([]);
  const [isMarkingRead, startMarkingRead] = useTransition();
  const title = pageTitleFor(pathname, user.roles, APP_NAME);
  const initials = initialsFromName(user.name);
  const roleLabel = sortRoles(user.roles)
    .map((r) => ROLE_LABEL[r])
    .join(" + ");
  const unreadNotifications = notificationItems.filter(
    (notification) => !notification.read && !locallyReadIds.includes(notification.id),
  );

  useEffect(() => {
    let active = true;

    async function refreshNotifications() {
      try {
        const response = await fetch("/api/notifikasi", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { notifications?: AppNotification[]; unreadCount?: number };
        if (active && Array.isArray(data.notifications)) {
          setNotificationItems(data.notifications);
          if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
        }
      } catch {
        // Kegagalan polling tidak mengganggu navigasi; percobaan berikutnya tetap berjalan.
      }
    }

    const interval = window.setInterval(refreshNotifications, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  function toggleNotifications() {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    setMenuOpen(false);

    if (!nextOpen || unreadCount === 0) return;

    const unreadIds = unreadNotifications.map((notification) => notification.id);
    const previousUnreadCount = unreadCount;
    setLocallyReadIds((current) => Array.from(new Set([...current, ...unreadIds])));
    setUnreadCount(0);
    startMarkingRead(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setLocallyReadIds((current) => current.filter((id) => !unreadIds.includes(id)));
        setUnreadCount(previousUnreadCount);
      }
    });
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3.5 border-b border-line bg-[color-mix(in_oklch,var(--surface),transparent_18%)] px-4 backdrop-blur lg:px-6">
      <button
        onClick={onMenu}
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 lg:hidden"
        aria-label="Buka menu"
      >
        <Icons.menu size={20} />
      </button>

      <h1 className="truncate text-[17px] font-bold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        <div className="relative">
            <button
              type="button"
              onClick={toggleNotifications}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-2 transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label={unreadCount > 0 ? `${unreadCount} notifikasi baru` : "Buka notifikasi"}
              aria-expanded={notificationOpen}
              disabled={isMarkingRead && notificationOpen}
            >
              <Icons.bell size={18} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[70] cursor-default"
                  onClick={() => setNotificationOpen(false)}
                  aria-label="Tutup notifikasi"
                />
                <div className="pop-enter absolute right-0 top-[calc(100%+8px)] z-[80] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-float">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <div>
                      <div className="text-sm font-bold text-ink">Notifikasi</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-3">Pembaruan penting untuk akun Anda</div>
                    </div>
                    <Icons.bell size={17} style={{ color: "var(--text-3)" }} />
                  </div>

                  {notificationItems.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <div className="text-[13.5px] font-semibold text-ink-2">Belum ada notifikasi</div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-3">
                        Pendaftaran, rapor, jadwal, dan pembaruan sistem akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      {notificationItems.map((notification) => {
                        const unread = !notification.read && !locallyReadIds.includes(notification.id);
                        const reportNotification = notification.type === "REPORT";
                        const admissionNotification = notification.type === "ADMISSION";
                        const scheduleNotification = notification.type === "SCHEDULE";

                        return (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            onClick={() => setNotificationOpen(false)}
                            className="flex gap-3 border-b border-line px-4 py-3.5 transition last:border-b-0 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                          >
                            <span
                              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                                reportNotification
                                  ? "bg-success-soft text-success"
                                  : admissionNotification
                                    ? "bg-primary-soft text-primary-700"
                                    : scheduleNotification
                                      ? "bg-accent-soft text-[oklch(0.42_0.1_200)]"
                                    : "bg-surface-2 text-ink-2"
                              }`}
                            >
                              {reportNotification ? (
                                <Icons.award size={17} />
                              ) : admissionNotification ? (
                                <Icons.doc size={16} />
                              ) : scheduleNotification ? (
                                <Icons.calendar size={16} />
                              ) : (
                                <Icons.bell size={16} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-2">
                                <span className="flex-1 text-[13.5px] font-bold text-ink">{notification.title}</span>
                                {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{notification.message}</span>
                              <span className="mt-1.5 block text-[11px] text-ink-3">
                                {notificationDateFmt.format(new Date(notification.createdAt))}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  <Link
                    href="/notifikasi"
                    onClick={() => setNotificationOpen(false)}
                    className="flex min-h-11 items-center justify-center border-t border-line px-4 text-xs font-bold text-primary-700 hover:bg-surface-2"
                  >
                    Lihat semua notifikasi
                  </Link>
                </div>
              </>
            ) : null}
          </div>

        <div className="relative">
          <button
            onClick={() => {
              setMenuOpen((open) => !open);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-full border border-line bg-surface p-1 pr-2 transition hover:bg-surface-2"
            aria-expanded={menuOpen}
          >
            <Avatar initials={initials} color="var(--primary)" size={32} />
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-[13px] font-bold">{user.name}</div>
              <div className="text-[11px] text-ink-3">{roleLabel}</div>
            </div>
            <Icons.chevD size={16} style={{ color: "var(--text-3)" }} />
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[70] cursor-default"
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu akun"
              />
              <div className="pop-enter absolute right-0 top-[calc(100%+8px)] z-[80] w-60 rounded-xl border border-line bg-surface p-2 shadow-float">
                <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">Akun</div>
                <div className="px-2.5 pb-2">
                  <div className="truncate text-[13px] font-bold">{user.name}</div>
                  <div className="truncate text-[11.5px] text-ink-3">{user.email}</div>
                </div>
                <div className="my-1.5 h-px bg-line" />
                <Link
                  href="/pengaturan"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2"
                >
                  <Icons.settings size={18} style={{ color: "var(--text-3)" }} />
                  Pengaturan
                </Link>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2"
                  >
                    <Icons.logout size={18} style={{ color: "var(--text-3)" }} />
                    Keluar
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
