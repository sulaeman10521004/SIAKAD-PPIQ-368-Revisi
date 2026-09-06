import Link from "next/link";
import { Badge, Card, Icons, SectionTitle, buttonClasses, type IconKey } from "@/components/ui";

type AttentionItem = {
  id: string;
  name: string;
  roles: string[];
  status: string | null;
  issues: string[];
};

const STATUS_META: Record<string, { label: string; tone: "success" | "primary" | "warning" | "danger" | "accent" }> = {
  PRESENT: { label: "Hadir", tone: "success" },
  EXCUSED: { label: "Izin", tone: "primary" },
  SICK: { label: "Sakit", tone: "accent" },
  LATE: { label: "Terlambat", tone: "warning" },
  ABSENT: { label: "Alpa", tone: "danger" },
};

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Ustadz",
  HOMEROOM: "Wali Kelas",
};

function roleLabel(roles: readonly string[]): string {
  return roles.map((r) => ROLE_LABEL[r] ?? r).join(" & ");
}

const ACADEMIC_LINKS = [
  { href: "/akademik", label: "Data Akademik", description: "Kelola kelas, mapel, ustadz pengampu, dan slot jadwal", icon: "settings" },
  { href: "/absen-ustadz", label: "Absensi ustadz", description: "Periksa laporan kehadiran dan BKKH", icon: "check2" },
] satisfies { href: string; label: string; description: string; icon: IconKey }[];

/**
 * Mudir-only content that is genuinely distinct from the shared dashboard
 * chrome (hero/stats/chart/schedule live once in dashboard/page.tsx). This
 * composes below that shared chrome instead of duplicating it.
 */
export function MudirPanel({ attention }: { attention: AttentionItem[] }) {
  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[1.45fr_1fr]">
      <div className="flex flex-col gap-[18px]">
        <Card pad={20}>
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[19px] font-bold tracking-tight">Perlu ditindaklanjuti</h2>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-3">
                Ustadz dengan kehadiran atau BKKH yang belum lengkap hari ini
              </p>
            </div>
            <Link href="/absen-ustadz" className={buttonClasses("ghost", "sm", "shrink-0")}>Lihat semua</Link>
          </div>
          {attention.length === 0 ? (
            <div className="rounded-xl bg-success-soft px-4 py-5 text-center">
              <Icons.check2 size={22} className="mx-auto text-success" />
              <p className="mt-2 text-sm font-semibold text-ink">Semua laporan ustadz sudah lengkap.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {attention.slice(0, 6).map((item) => {
                const status = item.status ? STATUS_META[item.status] : null;
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{item.name}</div>
                      <div className="mt-0.5 text-xs text-ink-3">{roleLabel(item.roles)}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Badge tone={status?.tone ?? "neutral"}>{status?.label ?? "Belum absen"}</Badge>
                      {item.issues.map((issue) => <Badge key={issue} tone="warning">{issue}</Badge>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-[18px]">
        <Card pad={20}>
          <SectionTitle title="Pengawasan akademik" sub="Akses cepat ke data yang perlu dipantau" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {ACADEMIC_LINKS.map((item) => {
              const Icon = Icons[item.icon];
              return (
                <Link key={item.href} href={item.href} className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-surface-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-700">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="block truncate text-xs text-ink-3">{item.description}</span>
                  </span>
                  <Icons.chevR size={16} className="text-ink-3" />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
