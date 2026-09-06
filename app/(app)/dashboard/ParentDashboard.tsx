import Link from "next/link";
import { Badge, Card, Icons, Ring, SectionTitle, buttonClasses, scoreColor, type Tone } from "@/components/ui";
import { AdmissionStatusEmpty, AdmissionStatusRow, type AdmissionStatusItem } from "../_components/AdmissionStatus";

type Level = "SD" | "SMP" | "SMA";

type Child = {
  childId: string;
  name: string;
  level: Level;
  className: string;
  studentNumber: string;
  courses: number;
  avg: number;
  attRate: number;
};

type PublishedReportCard = {
  id: string;
  childName: string;
  childId: string;
  semester: "GANJIL" | "GENAP";
  academicYear: string;
  publishedAt: string;
};

const LEVEL_TONE: Record<Level, Tone> = { SD: "accent", SMP: "primary", SMA: "success" };
const dateFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function ParentDashboard({
  name,
  kids,
  publishedReportCards = [],
  admissions = [],
}: {
  name: string;
  kids: Child[];
  publishedReportCards?: PublishedReportCard[];
  admissions?: AdmissionStatusItem[];
}) {
  const greet = name.split(" ")[0];
  const avgAll = kids.length ? Math.round(kids.reduce((s, c) => s + c.avg, 0) / kids.length) : 0;
  const attAll = kids.length ? Math.round(kids.reduce((s, c) => s + c.attRate, 0) / kids.length) : 0;

  return (
    <div className="view-enter flex flex-col" style={{ gap: 22 }}>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-[22px] p-6 text-white shadow-pop lg:p-8" style={{ background: "var(--primary-700)" }}>
        <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-[520px]">
            <div className="mb-2 text-[13px] font-semibold opacity-85">{dateFmt.format(new Date())}</div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight lg:text-3xl text-balance">Assalamualaikum, {greet}</h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed opacity-90 text-pretty">
              Pantau perkembangan nilai dan kehadiran {kids.length > 1 ? "anak-anak" : "anak"} Anda.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href="/anak" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary-700">
                Lihat Detail Anak
                <Icons.chevR size={17} />
              </Link>
              <Link href="/pendaftaran" className="inline-flex items-center rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white">
                Daftarkan Anak
              </Link>
            </div>
          </div>
          <div className="hidden flex-col items-center gap-1.5 sm:flex">
            <Ring value={attAll} size={120} stroke={12} color="#fff" label={`${attAll}%`} />
            <div className="text-[12.5px] font-semibold opacity-90">Rata Kehadiran</div>
          </div>
        </div>
      </div>

      {/* Merged Stat Cards (Unified 2x2 grid on mobile, 4 columns on desktop) */}
      <Card pad={18}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4" style={{ gap: "16px 20px" }}>
          {/* Stat 1: Anak Terpantau */}
          <div className="flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-primary">
                <Icons.users size={20} />
              </div>
            </div>
            <div className="mt-3.5 text-2xl font-extrabold tracking-tight">{kids.length}</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink-3">Anak Terpantau</div>
          </div>

          {/* Stat 2: Rata Nilai */}
          <div className="flex flex-col justify-between border-l border-line pl-4 lg:pl-5">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2" style={{ color: "var(--teal)" }}>
                <Icons.award size={20} />
              </div>
            </div>
            <div className="mt-3.5 text-2xl font-extrabold tracking-tight">{avgAll || "-"}</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink-3">Rata Nilai</div>
          </div>

          {/* Stat 3: Rata Kehadiran */}
          <div className="flex flex-col justify-between border-t border-line pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:border-line lg:pl-5">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2" style={{ color: "var(--green)" }}>
                <Icons.check2 size={20} />
              </div>
            </div>
            <div className="mt-3.5 text-2xl font-extrabold tracking-tight">{attAll}%</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink-3">Rata Kehadiran</div>
          </div>
        </div>
      </Card>

      {/* Main content */}
      <div className="flex flex-col gap-4.5" style={{ gap: 18 }}>
        {/* Children List */}
        <Card pad={20}>
          <SectionTitle title="Anak Saya" sub="Ringkasan tiap santri" action={<Link href="/anak" className={buttonClasses("ghost", "sm")}>Semua</Link>} />
          <div className="flex flex-col gap-3">
            {kids.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">Belum ada data anak terhubung dengan akun Anda.</p>
            ) : (
              kids.map((c) => (
                <Link key={c.childId} href={`/anak/${c.childId}`} className="flex items-center gap-3.5 rounded-xl border border-line p-3.5 transition hover:bg-surface-2">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary-700">{c.level}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold">{c.name}</span>
                      <Badge tone={LEVEL_TONE[c.level]}>{c.className}</Badge>
                    </div>
                    <div className="mt-1 flex gap-4 text-[12.5px] text-ink-3">
                      <span>Nilai <strong className="tabular-nums" style={{ color: scoreColor(c.avg) }}>{c.avg || "-"}</strong></span>
                      <span>Hadir <strong className="tabular-nums text-ink-2">{c.attRate}%</strong></span>
                      <span className="hidden sm:inline">{c.courses} mapel</span>
                    </div>
                  </div>
                  <Icons.chevR size={18} style={{ color: "var(--text-3)" }} />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Admission status */}
        <Card pad={20}>
          <SectionTitle
            title="Status Pendaftaran"
            sub="Pendaftaran santri baru yang Anda kirim"
            action={
              <Link href="/anak" className={buttonClasses("ghost", "sm")}>
                Rincian
              </Link>
            }
          />
          {admissions.length === 0 ? (
            <AdmissionStatusEmpty compact />
          ) : (
            <div className="flex flex-col gap-3">
              {admissions.slice(0, 3).map((item) => (
                <AdmissionStatusRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </Card>

        {/* Published Report Cards */}
        {publishedReportCards.length > 0 && (
          <Card pad={20}>
            <SectionTitle title="Rapor Semester Terbaru" sub="Rapor hasil belajar yang telah terbit resmi" />
            <div className="flex flex-col gap-3">
              {publishedReportCards.map((rc) => (
                <Link
                  key={rc.id}
                  href={`/anak/${rc.childId}`}
                  className="flex items-center justify-between gap-3.5 rounded-xl border border-line p-3.5 transition hover:bg-surface-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-success-soft text-success">
                      <Icons.award size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-bold text-ink">
                        Rapor {rc.childName}
                      </div>
                      <div className="text-[12.5px] text-ink-3">
                        Semester {rc.semester === "GANJIL" ? "Ganjil" : "Genap"} · TA {rc.academicYear}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-3">
                    <span className="hidden sm:inline">Terbit: {rc.publishedAt}</span>
                    <Icons.chevR size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
