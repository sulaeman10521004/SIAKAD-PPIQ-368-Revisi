"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { sortRoles } from "@/lib/permissions";
import { navFor, ROLE_BLURB, ROLE_LABEL, type Role } from "./nav";

export function Sidebar({ roles, open, onClose }: { roles: Role[]; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const items = navFor(roles);
  const heldRoles = sortRoles(roles);

  return (
    <>
      {/* mobile overlay */}
      {open ? (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[55] bg-[oklch(0.27_0.02_165_/_0.4)] lg:hidden"
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-[60] flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-surface transition-transform duration-300 lg:relative lg:translate-x-0 ${
          open ? "translate-x-0 shadow-float" : "-translate-x-full"
        }`}
      >
        {/* brand */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <img src="/icons/logo-mark.png" alt="" className="h-[38px] w-[38px] shrink-0 rounded-xl" />
          <div>
            <div className="text-[17px] font-extrabold tracking-tight">{APP_NAME}</div>
            <div className="text-[11px] font-semibold text-ink-3">{APP_TAGLINE}</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-2">
          <div className="px-2.5 pb-2 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">Menu Utama</div>
          <div className="flex flex-col gap-0.5">
            {items.map((it) => {
              const Icon = Icons[it.icon];
              const active = pathname === it.href || (it.href === "/mapel" && pathname.startsWith("/mapel"));
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onClose}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-primary-soft text-primary-700" : "text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {active ? (
                    <span className="absolute -left-3.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                  ) : null}
                  <Icon size={20} style={{ color: active ? "var(--primary)" : "var(--text-3)" }} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* role helper card */}
        <div className="p-3.5">
          <div className="rounded-xl border border-line bg-surface-2 p-3.5">
            <div className="mb-1 text-xs font-bold text-ink-2">
              Mode {heldRoles.map((r) => ROLE_LABEL[r]).join(" + ")}
            </div>
            <div className="flex flex-col gap-1">
              {heldRoles.map((r) => (
                <p key={r} className="text-[11.5px] leading-relaxed text-ink-3">
                  {ROLE_BLURB[r]}
                </p>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
