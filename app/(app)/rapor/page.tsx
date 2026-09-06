import Link from "next/link";
import { requireAnyPermission, userCan } from "@/lib/auth";
import { getCurrentPeriod, formatPeriod } from "@/lib/lms";
import { Card, Field, inputClasses } from "@/components/ui";
import { canReviewReports, getRaporBoard } from "@/lib/rapor";
import { REPORT_STATUS_LABEL } from "./status";
import { ReportBoardTable } from "./ReportBoardTable";
import { ReportCardStatus, Semester } from "@/generated/prisma/client";

export default async function RaporPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; semester?: string; year?: string }>;
}) {
  const [{ class: classParam, semester, year }, user] = await Promise.all([
    searchParams,
    requireAnyPermission(["report.manage", "report.approve", "report.distribute"]),
  ]);

  const isReviewer = canReviewReports(user);
  const isHomeroom = userCan(user, "report.manage");

  const currentPeriod = getCurrentPeriod();
  const activeSemester = Object.values(Semester).includes(semester as Semester)
    ? (semester as Semester)
    : currentPeriod.semester;
  const activeYear = year && /^\d{4}\/\d{4}$/.test(year) ? year : currentPeriod.academicYear;
  const period = { semester: activeSemester, academicYear: activeYear };

  const { classRooms, activeClass, students } = await getRaporBoard(user, period, classParam || undefined);

  // Wali kelas hanya boleh menyusun rapor kelas binaannya sendiri.
  const canEdit = isHomeroom && activeClass?.homeroomTeacherId === user.id;

  const currentYearNum = new Date().getFullYear();
  const academicYears = [
    `${currentYearNum - 1}/${currentYearNum}`,
    `${currentYearNum}/${currentYearNum + 1}`,
    `${currentYearNum + 1}/${currentYearNum + 2}`,
  ];

  const statusCounts = students.reduce<Record<string, number>>((acc, s) => {
    const key = s.reportCard?.status ?? "NONE";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="view-enter flex flex-col" style={{ gap: 20 }}>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            {isReviewer ? "ACC & Penerbitan Rapor" : "Rapor Kelas Binaan"}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {isReviewer
              ? "Periksa kelengkapan administrasi santri, ACC rapor kiriman wali kelas, lalu terbitkan agar wali santri dapat melihatnya."
              : "Susun nilai rapor, isi penilaian sikap dan catatan, lalu kirim ke administrasi untuk di-ACC."}
          </p>
        </div>
      </div>

      {/* Filter periode */}
      <Card pad={16} className="bg-surface-2">
        <form method="GET" action="/rapor" className="grid items-end gap-3.5 sm:grid-cols-3">
          {activeClass && <input type="hidden" name="class" value={activeClass.id} />}

          <Field label="Semester">
            <select name="semester" defaultValue={activeSemester} className={inputClasses}>
              <option value={Semester.GANJIL}>Ganjil</option>
              <option value={Semester.GENAP}>Genap</option>
            </select>
          </Field>

          <Field label="Tahun Ajaran">
            <select name="year" defaultValue={activeYear} className={inputClasses}>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </Field>

          <div className="mb-4">
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              Terapkan Filter
            </button>
          </div>
        </form>
      </Card>

      {classRooms.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">
            {isHomeroom && !isReviewer
              ? `Anda belum ditugaskan sebagai wali kelas pada tahun ajaran ${activeYear}.`
              : `Belum ada kelas pada tahun ajaran ${activeYear}.`}
          </p>
        </Card>
      ) : (
        <>
          {/* Pilihan kelas */}
          <div className="flex gap-2 overflow-x-auto border-b border-line pb-1">
            {classRooms.map((cls) => {
              const active = cls.id === activeClass?.id;
              return (
                <Link
                  key={cls.id}
                  href={`/rapor?class=${cls.id}&semester=${activeSemester}&year=${activeYear}`}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                    active ? "border-transparent bg-primary text-white" : "border-line bg-surface text-ink-2"
                  }`}
                >
                  Kelas {cls.name}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink-2">
              Periode Aktif: <span className="text-primary">{formatPeriod(period)}</span>
              {activeClass?.homeroomTeacher ? (
                <span className="ml-2 font-semibold text-ink-3">
                  • Wali Kelas: {activeClass.homeroomTeacher.name}
                </span>
              ) : null}
            </span>
            <span className="text-xs font-semibold text-ink-3">Total: {students.length} Santri</span>
          </div>

          {students.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-ink-3">
              <span className="rounded-full bg-surface-2 px-2.5 py-1">Belum dibuat: {statusCounts.NONE ?? 0}</span>
              {Object.values(ReportCardStatus).map((status) => (
                <span key={status} className="rounded-full bg-surface-2 px-2.5 py-1">
                  {REPORT_STATUS_LABEL[status]}: {statusCounts[status] ?? 0}
                </span>
              ))}
            </div>
          )}

          <ReportBoardTable
            students={students}
            semester={activeSemester}
            academicYear={activeYear}
            canEdit={Boolean(canEdit)}
          />
        </>
      )}
    </div>
  );
}
