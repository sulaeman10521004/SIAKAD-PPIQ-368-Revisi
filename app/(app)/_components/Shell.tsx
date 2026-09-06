"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type AppNotification } from "./Topbar";
import type { Role } from "./nav";

export function Shell({
  user,
  notifications,
  unreadNotificationCount,
  children,
}: {
  user: { name: string; email: string; roles: Role[] };
  notifications: AppNotification[];
  unreadNotificationCount: number;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-bg text-ink">
      <Sidebar roles={user.roles} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="app-content flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
          onMenu={() => setNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-12 pt-5 lg:px-8 lg:pt-7">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
