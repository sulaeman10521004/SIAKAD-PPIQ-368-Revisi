import { requirePermission } from "@/lib/auth";
import { getGradebook } from "@/lib/lms";
import { Avatar, Badge, Card, Field, buttonClasses, inputClasses, scoreColor, PASS_THRESHOLD } from "@/components/ui";
import { createGradeItemAction } from "../actions";
import { Gradebook } from "./Gradebook";
import { GradeItemManager } from "./GradeItemManager";

const ERROR_MESSAGE: Record<string, string> = {
  forbidden: "Anda tidak ditugaskan pada mata pelajaran ini, jadi komponen nilai tidak bisa dibuat.",
  duplicate: "Sudah ada komponen nilai dengan judul itu di mata pelajaran ini. Gunakan judul lain.",
  date: "Tenggat tidak valid. Isi ulang kolom tenggat.",
  maxscore: "Nilai maksimal terlalu besar. Gunakan bilangan bulat 1-1000.",
  missing: "Mata pelajaran sudah tidak tersedia. Muat ulang halaman.",
};

export default async function NilaiPage({ searchParams }: { searchParams: Promise<{ course?: string; error?: string }> }) {
  const [{ course, error }, user] = await Promise.all([searchParams, requirePermission("grade.manage")]);
  const { courses, activeCourseId, columns, rows, canEdit, teacherName, weightTotal } = await getGradebook(user, course);

  const classAvg = rows.length ? Math.round(rows.reduce((s, r) => s + r.avg, 0) / rows.length) : 0;
  const passing = rows.filter((r) => r.avg >= PASS_THRESHOLD).length;
  const top = rows.length ? [...rows].sort((a, b) => b.avg - a.avg)[0] : null;

  return (
    <div className="view-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Nilai</h1>
          <p className="mt-1 text-sm text-ink-3">Klik sel untuk mengubah nilai. Rata-rata dihitung otomatis.</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-line bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {ERROR_MESSAGE[error] ?? "Komponen nilai gagal dibuat. Periksa kembali isian Anda."}
        </div>
      ) : null}

      {courses.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada kelas.</p>
        </Card>
      ) : (
        <>
          {/* summary */}
          <Card pad={18} className="mb-5">
            <div className="grid grid-cols-2 gap-y-4 lg:grid-cols-4" style={{ gap: "16px 20px" }}>
              <div>
                <div className="text-[13px] font-semibold text-ink-3">Rata-rata Kelas</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight" style={{ color: scoreColor(classAvg) }}>
                    {classAvg}
                  </span>
                  <Badge tone={classAvg >= PASS_THRESHOLD ? "success" : "warning"}>{classAvg >= PASS_THRESHOLD ? "Tuntas" : "Perlu perhatian"}</Badge>
                </div>
              </div>
              <div className="border-l border-line pl-4 lg:pl-5">
                <div className="text-[13px] font-semibold text-ink-3">Tuntas (≥{PASS_THRESHOLD})</div>
                <div className="mt-2 text-3xl font-extrabold tracking-tight">
                  {passing}
                  <span className="text-[17px] text-ink-3">/{rows.length}</span>
                </div>
              </div>
              <div className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div className="text-[13px] font-semibold text-ink-3">Nilai Tertinggi</div>
                {top ? (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <Avatar initials={top.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} color="var(--green)" size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold">{top.name.split(" ")[0]}</div>
                      <div className="text-[12px] font-bold text-success">{top.avg}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-ink-3">-</div>
                )}
              </div>
              <div className="min-w-0 border-l border-t border-line pl-4 pt-4 lg:pl-5 lg:pt-0 lg:border-t-0">
                <div className="text-[13px] font-semibold text-ink-3">Komponen</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {columns.length ? columns.map((c) => <Badge key={c.id} tone="neutral">{c.title}</Badge>) : <span className="text-sm text-ink-3">-</span>}
                </div>
              </div>
            </div>
          </Card>

          {/* Daftar mapel panjang memakai dropdown, bukan scroll horizontal. */}
          <form action="/nilai" method="GET" className="mb-3.5 grid gap-2 sm:max-w-[520px] sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="course-nilai" className="mb-1 block text-[11.5px] font-semibold text-ink-3">Mata pelajaran</label>
              <select id="course-nilai" name="course" defaultValue={activeCourseId ?? ""} className={inputClasses}>
                {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
            <button type="submit" className={`${buttonClasses("ghost", "md")} self-end`}>Tampilkan</button>
          </form>

          {/* add component */}
          {activeCourseId && canEdit ? (
            <Card pad={16} className="mb-3.5">
              <form action={createGradeItemAction} className="grid gap-3 md:grid-cols-[1fr_0.45fr_0.45fr_0.7fr_auto]">
                <input type="hidden" name="courseId" value={activeCourseId} />
                <Field label="Komponen baru">
                  <input name="title" required placeholder="cth. UH 1" className={inputClasses} />
                </Field>
                <Field label="Nilai maks">
                  <input name="maxScore" type="number" min={1} max={1000} defaultValue={100} className={inputClasses} />
                </Field>
                <Field label={`Bobot % (kini ${weightTotal}%)`}>
                  <input name="weight" type="number" min={0} max={100} defaultValue={0} className={inputClasses} />
                </Field>
                <Field label="Tenggat (opsional)">
                  <input name="dueAt" type="date" className={inputClasses} />
                </Field>
                <div className="flex items-end">
                  <button type="submit" className={buttonClasses("primary", "md")}>
                    Tambah
                  </button>
                </div>
              </form>
            </Card>
          ) : null}

          {/* bukan pengampu: jelaskan, jangan tampilkan form yang pasti ditolak */}
          {activeCourseId && !canEdit ? (
            <Card pad={16} className="mb-3.5">
              <div className="text-[13.5px] font-bold">Hanya pengampu yang dapat mengelola nilai</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                Mata pelajaran ini diampu oleh <strong className="text-ink-2">{teacherName ?? "belum ditugaskan"}</strong>. Nilai hanya boleh diisi
                dan diubah oleh pengampu yang ditugaskan. Minta mudir menugaskan pengampu melalui menu Data Akademik (/akademik).
              </p>
            </Card>
          ) : null}

          {canEdit ? <GradeItemManager items={columns} weightTotal={weightTotal} /> : null}

          {activeCourseId && rows.length === 0 ? (
            <Card pad={28}>
              <div className="text-center">
                <div className="text-[14px] font-bold">Belum ada santri di mata pelajaran ini</div>
                <p className="mx-auto mt-1.5 max-w-[520px] text-[13px] leading-relaxed text-ink-3">
                  Komponen nilai tetap bisa dibuat, tetapi daftar santri masih kosong. Mudir mendaftarkan santri ke mata pelajaran melalui
                  menu Data Akademik (/akademik).
                </p>
              </div>
            </Card>
          ) : (
            <Gradebook columns={columns} rows={rows} canEdit={canEdit} />
          )}
        </>
      )}
    </div>
  );
}
