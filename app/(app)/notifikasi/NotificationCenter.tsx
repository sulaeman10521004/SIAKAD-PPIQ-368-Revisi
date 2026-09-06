"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Icons, type Tone } from "@/components/ui";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

type NotificationType = "ADMISSION" | "REPORT" | "SCHEDULE" | "SYSTEM";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  ADMISSION: "Pendaftaran",
  REPORT: "Rapor",
  SCHEDULE: "Jadwal",
  SYSTEM: "Sistem",
};

const TYPE_TONE: Record<NotificationType, Tone> = {
  ADMISSION: "primary",
  REPORT: "success",
  SCHEDULE: "accent",
  SYSTEM: "neutral",
};

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === "REPORT") return <Icons.award size={19} />;
  if (type === "ADMISSION") return <Icons.doc size={18} />;
  if (type === "SCHEDULE") return <Icons.calendar size={18} />;
  return <Icons.bell size={18} />;
}

export function NotificationCenter({ items, unreadCount }: { items: NotificationItem[]; unreadCount: number }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState(() => items.filter((item) => item.read).map((item) => item.id));
  const [pending, startTransition] = useTransition();
  const [remainingUnread, setRemainingUnread] = useState(unreadCount);

  function markAllRead() {
    const previous = readIds;
    const previousUnread = remainingUnread;
    setReadIds(items.map((item) => item.id));
    setRemainingUnread(0);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setReadIds(previous);
        setRemainingUnread(previousUnread);
      }
      else router.refresh();
    });
  }

  function openNotification(item: NotificationItem) {
    if (readIds.includes(item.id)) {
      router.push(item.href);
      return;
    }

    setReadIds((current) => [...current, item.id]);
    setRemainingUnread((current) => Math.max(0, current - 1));
    startTransition(async () => {
      await markNotificationReadAction(item.id);
      router.push(item.href);
    });
  }

  return (
    <div className="view-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-balance">Notifikasi</h1>
          <p className="mt-1 text-sm text-ink-3 text-pretty">
            Pendaftaran, rapor, jadwal, dan pembaruan penting untuk akun Anda.
          </p>
        </div>
        {remainingUnread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={pending}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
          >
            Tandai semua sudah dibaca
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Card pad={40}>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-3">
            <Icons.bell size={21} />
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-ink-2">Belum ada notifikasi</p>
          <p className="mx-auto mt-1 max-w-md text-center text-xs leading-relaxed text-ink-3">
            Pembaruan pendaftaran, rapor, dan jadwal akan tersimpan di halaman ini.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((item) => {
            const read = readIds.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                disabled={pending}
                className={`flex min-h-24 w-full gap-3.5 border-b border-line px-4 py-4 text-left transition last:border-b-0 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:cursor-wait ${
                  read ? "bg-surface" : "bg-primary-soft/35"
                }`}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    item.type === "REPORT"
                      ? "bg-success-soft text-success"
                      : item.type === "ADMISSION"
                        ? "bg-primary-soft text-primary-700"
                        : item.type === "SCHEDULE"
                          ? "bg-accent-soft text-[oklch(0.42_0.1_200)]"
                        : "bg-surface-2 text-ink-2"
                  }`}
                >
                  <NotificationIcon type={item.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-bold text-ink">{item.title}</span>
                    <Badge tone={TYPE_TONE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
                    {!read ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="Belum dibaca" /> : null}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{item.message}</span>
                  <span className="mt-2 block text-[11.5px] text-ink-3">{item.createdAt}</span>
                </span>
                <Icons.chevR size={17} className="mt-3 shrink-0 text-ink-3" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
