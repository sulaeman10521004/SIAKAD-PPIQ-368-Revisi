import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getAttendanceBoard, toDateKey } from "@/lib/lms";
import { Card, Field, Icons, buttonClasses, inputClasses } from "@/components/ui";
import { createAttendanceSessionAction } from "../actions";
import { AttendanceWorkspace } from "./AttendanceWorkspace";
import { SessionManager } from "./SessionManager";

const ERROR_MESSAGE: Record<string, string> = {
  forbidden: "Anda tidak ditugaskan pada mata pelajaran ini, jadi sesi absensi tidak bisa dibuat.",
  duplicate: "Sudah ada sesi absensi dengan judul itu di mata pelajaran ini. Gunakan judul lain.",
  date: "Tanggal & waktu sesi tidak valid. Isi ulang kolom tanggal & waktu.",
  missing: "Mata pelajaran sudah tidak tersedia. Muat ulang halaman.",
};

const rangeFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function formatDateKey(dateKey: string): string {
  return rangeFmt.format(new Date(`${dateKey}T00:00:00`));
}

function rangeLabelOf(from: string | null, to: string | null): string {
  if (from && to) return `${formatDateKey(from)} – ${formatDateKey(to)}`;
  if (from) return `Sejak ${formatDateKey(from)}`;
  if (to) return `Sampai ${formatDateKey(to)}`;
  return "Semua sesi";
}

function shiftDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Pintasan rentang yang paling sering dipakai saat memantau absensi. */
function rangePresets(today: Date) {
  const todayKey = toDateKey(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return [
    { label: "Semua sesi", from: null, to: null },
    { label: "7 hari terakhir", from: shiftDays(today, -6), to: todayKey },
    { label: "30 hari terakhir", from: shiftDays(today, -29), to: todayKey },
    { label: "Bulan ini", from: toDateKey(monthStart), to: todayKey },
  ];
}

function hrefFor(courseId: string | null, from: string | null, to: string | null): string {
  const params = new URLSearchParams();
  if (courseId) params.set("course", courseId);
  if (from) params.set("dari", from);
  if (to) params.set("sampai", to);
  const query = params.toString();
  return query ? `/absen?${query}` : "/absen";
}

export default async function AbsenPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; error?: string; dari?: string; sampai?: string }>;
}) {
  const [{ course, error, dari, sampai }, user] = await Promise.all([searchParams, requirePermission("attendance.record")]);
  const { courses, activeCourseId, sessions, rows, canEdit, teacherName, range, bounds } = await getAttendanceBoard(
    user,
    course,
    dari,
    sampai,
  );

  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? null;
  const rangeLabel = rangeLabelOf(range.from, range.to);
  const presets = rangePresets(new Date());
  const filtered = Boolean(range.from || range.to);

  return (
    <div className="view-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Absensi Santri</h1>
          <p className="mt-1 text-sm text-ink-3">
            {canEdit
              ? "Ambil absen per sesi, saring, pantau kehadiran, lalu ekspor rekapnya."
              : "Pantau kehadiran santri per sesi dan ekspor rekapnya."}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-line bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {ERROR_MESSAGE[error] ?? "Sesi absensi gagal dibuat. Periksa kembali isian Anda."}
        </div>
      ) : null}

      {courses.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada kelas.</p>
        </Card>
      ) : (
        <>
          {/* Pemilih mapel berbentuk dropdown agar daftar panjang tidak menjadi scroll horizontal. */}
          <form action="/absen" method="GET" className="mb-3.5 grid gap-2 sm:max-w-[520px] sm:grid-cols-[1fr_auto]">
            {range.from ? <input type="hidden" name="dari" value={range.from} /> : null}
            {range.to ? <input type="hidden" name="sampai" value={range.to} /> : null}
            <div>
              <label htmlFor="course-absen" className="mb-1 block text-[11.5px] font-semibold text-ink-3">Mata pelajaran</label>
              <select id="course-absen" name="course" defaultValue={activeCourseId ?? ""} className={inputClasses}>
                {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
            <button type="submit" className={`${buttonClasses("ghost", "md")} self-end`}>Tampilkan</button>
          </form>

          {/* saringan rentang tanggal */}
          <Card pad={14} className="mb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-3">
                <Icons.filter size={14} /> Rentang
              </span>
              {presets.map((p) => {
                const active = (range.from ?? null) === p.from && (range.to ?? null) === p.to;
                return (
                  <Link
                    key={p.label}
                    href={hrefFor(activeCourseId, p.from, p.to)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      active ? "border-transparent bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>

            <form action="/absen" method="GET" className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
              {activeCourseId ? <input type="hidden" name="course" value={activeCourseId} /> : null}
              <div>
                <label htmlFor="dari" className="mb-1 block text-[11.5px] font-semibold text-ink-3">
                  Dari tanggal
                </label>
                <input id="dari" type="date" name="dari" defaultValue={range.from ?? ""} className={inputClasses} />
              </div>
              <div>
                <label htmlFor="sampai" className="mb-1 block text-[11.5px] font-semibold text-ink-3">
                  Sampai tanggal
                </label>
                <input id="sampai" type="date" name="sampai" defaultValue={range.to ?? ""} className={inputClasses} />
              </div>
              <button type="submit" className={buttonClasses("ghost", "md")}>
                Terapkan
              </button>
              <p className="ml-auto text-[12.5px] text-ink-3">
                {filtered ? `${sessions.length} dari ${bounds.total} sesi` : `${bounds.total} sesi`}
                {bounds.first && bounds.last ? ` • tersedia ${formatDateKey(bounds.first)} – ${formatDateKey(bounds.last)}` : ""}
              </p>
            </form>
          </Card>

          {/* bukan pengampu: jelaskan, jangan tampilkan alat yang pasti ditolak */}
          {activeCourseId && !canEdit ? (
            <Card pad={16} className="mb-3.5">
              <div className="text-[13.5px] font-bold">Hanya pengampu yang dapat mencatat absensi</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                Mata pelajaran ini diampu oleh <strong className="text-ink-2">{teacherName ?? "belum ditugaskan"}</strong>. Anda tetap bisa
                memantau dan mengekspor rekapnya. Minta mudir menugaskan pengampu melalui menu Data Akademik (/akademik).
              </p>
            </Card>
          ) : null}

          {activeCourseId && rows.length === 0 ? (
            <Card pad={28}>
              <div className="text-center">
                <div className="text-[14px] font-bold">Belum ada santri di mata pelajaran ini</div>
                <p className="mx-auto mt-1.5 max-w-[520px] text-[13px] leading-relaxed text-ink-3">
                  Sesi absensi tetap bisa dibuat, tetapi daftar santri masih kosong. Mudir mendaftarkan santri ke mata pelajaran melalui
                  menu Data Akademik (/akademik).
                </p>
              </div>
            </Card>
          ) : (
            <AttendanceWorkspace
              courseTitle={activeCourse?.title ?? "Mata pelajaran"}
              teacherName={teacherName}
              rangeLabel={rangeLabel}
              sessions={sessions}
              rows={rows}
              canEdit={canEdit}
            />
          )}

          {sessions.length === 0 && filtered && bounds.total > 0 ? (
            <p className="mt-2.5 text-[12.5px] text-ink-3">
              Rentang ini belum punya sesi.{" "}
              <Link href={hrefFor(activeCourseId, null, null)} className="font-semibold text-primary-700 underline">
                Lihat semua sesi
              </Link>
              .
            </p>
          ) : null}

          {/* kelola sesi */}
          {activeCourseId && canEdit ? (
            <details className="mt-4 rounded-2xl border border-line bg-surface shadow-soft">
              <summary className="cursor-pointer list-none px-5 py-4 text-[13.5px] font-bold">
                Kelola sesi absensi
                <span className="ml-2 font-semibold text-ink-3">
                  ({sessions.length} sesi{filtered ? ` dari ${bounds.total}, sesuai rentang` : ""})
                </span>
              </summary>
              <div className="border-t border-line px-5 py-4">
                <form action={createAttendanceSessionAction} className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto]">
                  <input type="hidden" name="courseId" value={activeCourseId} />
                  <Field label="Judul sesi">
                    <input name="title" required placeholder="cth. Pertemuan 5" className={inputClasses} />
                  </Field>
                  <Field label="Tanggal & waktu">
                    <input name="heldAt" type="datetime-local" required className={inputClasses} />
                  </Field>
                  <div className="flex items-end pb-4">
                    <button type="submit" className={buttonClasses("primary", "md")}>
                      Buat sesi
                    </button>
                  </div>
                </form>
                <SessionManager sessions={sessions} />
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
