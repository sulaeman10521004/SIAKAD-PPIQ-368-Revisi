import Link from "next/link";
import { getAdmissionsBySubmitter } from "@/lib/admissions";
import { requireVerifiedUser, userCan } from "@/lib/auth";
import { BKKH_TIME_SLOTS, countFilledBkkhSlots } from "@/lib/bkkh";
import {
  getBkkhDailyReports,
  getDashboardData,
  getParentChildren,
  getStaffAttendanceBoard,
  toDateKey,
} from "@/lib/lms";
import { getChildRaporSheets } from "@/lib/rapor";
import {
  Avatar,
  BarChart,
  Badge,
  Card,
  Icons,
  Ring,
  SectionTitle,
  buttonClasses,
  courseAccent,
  initialsFromName,
  type IconKey,
} from "@/components/ui";
import { toAdmissionStatusItems } from "../_components/AdmissionStatus";
import { ParentDashboard } from "./ParentDashboard";
import { MudirPanel } from "./MudirPanel";

const dateFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const annFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

export default async function DashboardPage() {
  const user = await requireVerifiedUser();

  // Permission-derived flags — a user can hold multiple roles, so every
  // section below renders independently instead of picking a single variant.
  const canMonitorChildren = userCan(user, "child.monitor");
  const canManageCourses = userCan(user, "course.manage");
  const canReviewAdmissions = userCan(user, "admission.review");
  const canManageGrades = userCan(user, "grade.manage");
  const canManageReports = userCan(user, "report.manage");
  const canViewCourses = userCan(user, "course.view");

  // Any of these permissions needs the shared dashboard chrome (hero, stat
  // tiles, weekly activity chart, today's schedule) rendered below, exactly
  // once, regardless of how many of these flags are true at the same time.
  const needsDashboardData = canReviewAdmissions || canManageGrades || canManageCourses;
  const data = needsDashboardData ? await getDashboardData(user) : undefined;

  const dateKey = toDateKey(new Date());
  const [staff, bkkhReports] = canManageCourses
    ? await Promise.all([getStaffAttendanceBoard(dateKey), getBkkhDailyReports(dateKey)])
    : [[], new Map()];
  const attention = canManageCourses
    ? staff
        .map((row) => {
          const report = bkkhReports.get(row.id);
          const filledSlots = countFilledBkkhSlots(report);
          const issues: string[] = [];
          if (!report) issues.push("BKKH belum diisi");
          else if (filledSlots < BKKH_TIME_SLOTS.length) issues.push(`BKKH ${filledSlots}/${BKKH_TIME_SLOTS.length}`);
          return { id: row.id, name: row.name, roles: row.roles, status: row.status, issues };
        })
        .filter((row) => row.status !== "PRESENT" || row.issues.length > 0)
        .sort((a, b) => b.issues.length - a.issues.length)
    : [];

  let parentSection: React.ReactNode = null;
  if (canMonitorChildren) {
    const [children, admissions] = await Promise.all([
      getParentChildren(user.id),
      getAdmissionsBySubmitter(user.id),
    ]);

    // Hanya rapor PUBLISHED yang dikembalikan getChildRaporSheets.
    const reportCardsList = await Promise.all(
      children.map(async (child) => {
        const sheets = await getChildRaporSheets(user.id, child.childId);
        return (sheets ?? []).map((sheet) => ({
          id: sheet.id,
          semester: sheet.semester,
          academicYear: sheet.academicYear,
          publishedAt: sheet.publishedAt,
          childName: child.name,
          childId: child.childId,
        }));
      })
    );
    const publishedReportCards = reportCardsList.flat();

    parentSection = (
      <ParentDashboard
        name={user.name}
        kids={children}
        admissions={toAdmissionStatusItems(admissions)}
        publishedReportCards={publishedReportCards.map((rc) => ({
          id: rc.id,
          childName: rc.childName,
          childId: rc.childId,
          semester: rc.semester,
          academicYear: rc.academicYear,
          publishedAt: rc.publishedAt ? annFmt.format(rc.publishedAt) : "-",
        }))}
      />
    );
  }

  const greet = user.name.split(" ")[0];

  const primaryCta = canReviewAdmissions
    ? { href: "/pengguna", label: "Kelola Pengguna" }
    : canManageReports
      ? { href: "/rapor", label: "Kelola Rapor" }
      : canManageGrades
        ? { href: "/nilai", label: "Mulai Menilai" }
        : canManageCourses
          ? { href: "/absen-ustadz", label: "Periksa Laporan Ustadz" }
          : { href: "/dashboard", label: "Lihat Dasbor" };

  const secondaryCta = canReviewAdmissions
    ? { href: "/penerimaan", label: "Tinjau Pendaftaran" }
    : canManageReports
      ? { href: "/absen", label: "Pantau Kelas" }
      : canManageGrades
        ? { href: "/absen", label: "Lihat Absensi" }
        : canManageCourses
          ? { href: "/akademik?tab=jadwal", label: "Kelola Jadwal" }
          : { href: "/anak", label: "Anak Saya" };

  const heroBlurb =
    canManageGrades && !canManageReports
      ? "Kelola mata pelajaran, catat kehadiran, dan isi nilai kelas yang kamu ampu hari ini."
      : canManageReports
        ? "Pantau kelas binaan, absensi santri, dan nilai untuk wali."
        : canManageCourses && !canReviewAdmissions
          ? "Pantau kehadiran ustadz, BKKH, dan jadwal pengajaran pesantren."
          : "Kelola pendaftaran, akun, data dasar, jadwal, dan operasional pesantren.";

  return (
    <div className="view-enter flex flex-col" style={{ gap: 28 }}>
      {parentSection}

      {data ? (
        <div className="flex flex-col gap-5.5" style={{ gap: 22 }}>
          {/* Hero */}
          <div
            className="relative overflow-hidden rounded-[22px] p-6 text-white shadow-pop lg:p-8"
            style={{ background: "var(--primary-700)" }}
          >
            <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/[0.07]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-[520px]">
                <div className="mb-2 text-[13px] font-semibold opacity-85">{dateFmt.format(new Date())}</div>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight lg:text-3xl">Selamat datang, {greet} 👋</h1>
                <p className="mt-2.5 text-[14.5px] leading-relaxed opacity-90">{heroBlurb}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link
                    href={primaryCta.href}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary-700"
                  >
                    {primaryCta.label}
                    <Icons.chevR size={17} />
                  </Link>
                  <Link
                    href={secondaryCta.href}
                    className="inline-flex items-center rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    {secondaryCta.label}
                  </Link>
                </div>
              </div>
              <div className="hidden flex-col items-center gap-1.5 sm:flex">
                <Ring value={data.hero.value} size={120} stroke={12} color="#fff" label={`${data.hero.value}%`} />
                <div className="max-w-32 text-center text-[12.5px] font-semibold opacity-90">{data.hero.label}</div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <Card pad={18}>
            <div
              className="grid grid-cols-2 lg:grid-cols-4 gap-y-4 max-lg:[&>*:nth-child(2n)]:border-l max-lg:[&>*:nth-child(2n)]:border-line max-lg:[&>*:nth-child(2n)]:pl-4 max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:nth-child(n+3)]:border-line max-lg:[&>*:nth-child(n+3)]:pt-4 lg:[&>*:not(:nth-child(4n+1))]:border-l lg:[&>*:not(:nth-child(4n+1))]:border-line lg:[&>*:not(:nth-child(4n+1))]:pl-5 lg:[&>*:nth-child(n+5)]:border-t lg:[&>*:nth-child(n+5)]:border-line lg:[&>*:nth-child(n+5)]:pt-4"
              style={{ gap: "16px 20px" }}
            >
              {data.stats.map((s) => {
                const Icon = Icons[s.icon as IconKey];

                return (
                  <div key={s.label} className="flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2" style={{ color: s.tone }}>
                        <Icon size={20} />
                      </div>
                      {s.delta ? (
                        <Badge tone={s.up ? "success" : "warning"}>
                          {s.up ? <Icons.arrowUp size={11} /> : null}
                          {s.delta}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3.5 text-2xl font-extrabold tracking-tight">{s.value}</div>
                    <div className="mt-0.5 text-[12.5px] font-medium text-ink-3">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Main grid */}
          <div className="grid items-start gap-4.5 lg:grid-cols-[1.55fr_1fr]" style={{ gap: 18 }}>
            <div className="flex flex-col gap-4.5" style={{ gap: 18 }}>
              {/* Mata pelajaran */}
              {canViewCourses ? (
                <Card pad={20}>
                  <SectionTitle
                    title="Mata Pelajaran"
                    sub={canManageGrades && !canManageReports ? "Mapel yang ditugaskan kepada Anda" : "Mapel terbaru dan jumlah pesertanya"}
                    action={
                      <Link href="/jadwal" className={buttonClasses("ghost", "sm")}>
                        Semua mapel
                      </Link>
                    }
                  />
                  <div className="flex flex-col gap-3">
                    {data.courses.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
                        Belum ada mata pelajaran.
                      </p>
                    ) : (
                      data.courses.slice(0, 3).map((c) => {
                        const accent = courseAccent(c.id);
                        return (
                          <Link
                            key={c.id}
                            href={`/mapel/${c.id}`}
                            className="flex items-center gap-3.5 rounded-xl border border-line p-3 transition hover:bg-surface-2"
                          >
                            <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl" style={{ background: accent.soft, color: accent.color }}>
                              <Icons.book size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14.5px] font-bold">{c.title}</div>
                              <div className="mt-0.5 text-[12.5px] text-ink-3">{c.students} santri terdaftar</div>
                            </div>
                            <Icons.chevR size={18} style={{ color: "var(--text-3)" }} />
                          </Link>
                        );
                      })
                    )}
                  </div>
                </Card>
              ) : null}

              {/* Weekly activity */}
              <Card pad={20}>
                <SectionTitle title={data.weeklyTitle} sub={data.weeklySub} />
                <BarChart data={data.weeklyActivity} height={140} />
              </Card>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4.5" style={{ gap: 18 }}>
              {/* Today schedule */}
              <Card pad={20}>
                <SectionTitle title="Jadwal Hari Ini" />
                <div className="flex flex-col gap-1">
                  {data.schedule.length === 0 ? (
                    <p className="text-sm text-ink-3">Tidak ada jadwal hari ini.</p>
                  ) : (
                    data.schedule.map((t, i) => {
                      const accent = courseAccent(t.id);
                      return (
                        <div key={t.id} className="flex gap-3" style={{ paddingBottom: i < data.schedule.length - 1 ? 14 : 0 }}>
                          <div className="flex flex-col items-center">
                            <div className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: accent.color }} />
                            {i < data.schedule.length - 1 ? <div className="mt-1 w-0.5 flex-1 bg-line" /> : null}
                          </div>
                          <div className="flex-1 pb-1">
                            <span className="mono text-[12.5px] font-semibold text-ink-2">{t.time}</span>
                            <div className="mt-0.5 text-sm font-bold">{t.title}</div>
                            <div className="mt-px text-[12.5px] text-ink-3">
                              {t.room} · {t.teacher}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Deadlines */}
              {canManageGrades ? (
                <Card pad={20}>
                  <SectionTitle title="Tenggat Terdekat" />
                  <div className="flex flex-col gap-2.5">
                    {data.deadlines.length === 0 ? (
                      <p className="text-sm text-ink-3">Tidak ada tenggat mendatang.</p>
                    ) : (
                      data.deadlines.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                          <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary">
                            <Icons.clock size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-semibold">{d.title}</div>
                            <div className="text-xs text-ink-3">{d.course}</div>
                          </div>
                          <div className="text-right text-[13px] font-bold">{d.due}</div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              ) : null}

              {/* Activity feed */}
              {data.activity.length > 0 ? (
                <Card pad={20}>
                  <SectionTitle title="Aktivitas Terbaru" />
                  <div className="flex flex-col gap-3.5">
                    {data.activity.map((a, i) => (
                      <div key={i} className="flex gap-2.5">
                        <Avatar initials={initialsFromName(a.who)} color="var(--primary)" size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] leading-snug">
                            <strong className="font-bold">{a.who}</strong> <span className="text-ink-2">{a.text}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-3">
                            <span>{a.when}</span>
                            <Badge tone="neutral">{a.tag}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {canManageCourses && data ? <MudirPanel attention={attention} /> : null}
    </div>
  );
}
