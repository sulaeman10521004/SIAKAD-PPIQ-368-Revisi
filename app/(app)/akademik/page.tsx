import Link from "next/link";
import { redirect } from "next/navigation";
import { EducationLevel, Semester } from "@/generated/prisma/client";
import { requireAnyPermission, requirePermission, userCan } from "@/lib/auth";
import {
  getAdministrationBoard,
  getAssessmentGroupBoard,
  getClassBoard,
  getCourseBoard,
  getEnrollmentBoard,
  getGradeWeightBoard,
} from "@/lib/akademik";
import { LEVEL_FULL, LEVEL_LABEL, LEVELS } from "@/lib/brand";
import { getCurrentPeriod, getScheduleBoard } from "@/lib/lms";
import type { Permission, Role } from "@/lib/permissions";
import { getReportSignatories } from "@/lib/rapor";
import { Card, Field, Icons, inputClasses } from "@/components/ui";
import { createScheduleSlotAction } from "../actions";
import { akademikTitle } from "../_components/nav";
import { DayGrid } from "../jadwal/ScheduleList";
import { AdministrasiManager } from "./AdministrasiManager";
import { BobotManager } from "./BobotManager";
import { KelasManager } from "./KelasManager";
import { KelompokManager } from "./KelompokManager";
import { MapelManager } from "./MapelManager";
import { PenandaTanganManager } from "./PenandaTanganManager";
import { PesertaManager } from "./PesertaManager";

type TabKey = "kelas" | "mapel" | "jadwal" | "peserta" | "kelompok" | "bobot" | "penandatangan" | "administrasi";

const TABS: { key: TabKey; label: string; permission: Permission }[] = [
  { key: "kelas", label: "Kelas", permission: "class.manage" },
  { key: "mapel", label: "Mapel & Pengampu", permission: "course.manage" },
  { key: "jadwal", label: "Jadwal", permission: "course.manage" },
  { key: "peserta", label: "Peserta Mapel", permission: "course.manage" },
  { key: "kelompok", label: "Kelompok Penilaian", permission: "assessment.configure" },
  { key: "bobot", label: "Bobot Komponen Nilai", permission: "assessment.configure" },
  { key: "penandatangan", label: "Penanda Tangan Rapor", permission: "report.distribute" },
  { key: "administrasi", label: "Administrasi Santri", permission: "administration.manage" },
];

const ACADEMIC_YEAR_RE = /^\d{4}\/\d{4}$/;

/**
 * Ringkasan isi halaman dibuat dari tab yang benar-benar terlihat, supaya
 * administrasi dan mudir tidak dijanjikan tab milik peran yang lain.
 */
function describeTabs(tabs: readonly { label: string }[]): string {
  const names = tabs.map((t) => t.label.toLowerCase());
  if (names.length <= 1) return names[0] ?? "data akademik";
  return `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`;
}

async function KelasSection() {
  await requirePermission("class.manage");
  const board = await getClassBoard();
  return <KelasManager {...board} />;
}

async function MapelSection() {
  const user = await requirePermission("course.manage");
  const board = await getCourseBoard();
  return (
    <MapelManager
      {...board}
      canConfigureAssessment={userCan(user, "assessment.configure")}
      canManageClass={userCan(user, "class.manage")}
    />
  );
}

async function JadwalSection({ level, error }: { level?: string; error?: string }) {
  const user = await requirePermission("course.manage");
  const activeLevel = Object.values(EducationLevel).includes(level as EducationLevel)
    ? (level as EducationLevel)
    : EducationLevel.SMP;
  const { days, courses } = await getScheduleBoard(user, activeLevel);
  const filteredCourses = courses.filter((c) => c.level === activeLevel);
  const errorMessage =
    error === "conflict"
      ? "Jadwal bertabrakan dengan penggunaan ruangan atau jadwal pengajar pada rentang waktu tersebut."
      : error
        ? "Jadwal gagal disimpan. Lengkapi mapel, hari, waktu mulai dan selesai, serta ruangan. Waktu selesai harus setelah waktu mulai."
        : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[19px] font-bold tracking-tight">Jadwal Pelajaran</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-3">Atur slot jadwal per jenjang. Semua peran melihat jadwal ini lewat menu Jadwal.</p>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-line pb-px overflow-x-auto">
        {LEVELS.map((lvl) => {
          const active = lvl === activeLevel;
          return (
            <Link
              key={lvl}
              href={`/akademik?tab=jadwal&level=${lvl}`}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${
                active ? "border-primary text-primary" : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {LEVEL_FULL[lvl] === LEVEL_LABEL[lvl] ? LEVEL_LABEL[lvl] : `${LEVEL_FULL[lvl]} (${LEVEL_LABEL[lvl]})`}
            </Link>
          );
        })}
      </div>

      <Card pad={18}>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-3">Tambah Slot Jadwal</h3>
        <form action={createScheduleSlotAction} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1.1fr_auto] items-end">
          <input type="hidden" name="level" value={activeLevel} />
          <Field label="Mata Pelajaran">
            <select name="courseId" required className={inputClasses}>
              <option value="">-- Pilih Mapel --</option>
              {filteredCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.classRoom?.name ? ` · ${c.classRoom.name}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hari">
            <select name="dayOfWeek" required className={inputClasses}>
              <option value="1">Senin</option>
              <option value="2">Selasa</option>
              <option value="3">Rabu</option>
              <option value="4">Kamis</option>
              <option value="5">Jumat</option>
              <option value="6">Sabtu</option>
              <option value="0">Ahad</option>
            </select>
          </Field>

          <Field label="Waktu Mulai">
            <input name="startTime" type="time" required className={inputClasses} />
          </Field>

          <Field label="Waktu Selesai">
            <input name="endTime" type="time" required className={inputClasses} />
          </Field>

          <Field label="Ruangan">
            <input name="room" type="text" required maxLength={80} placeholder="cth. Kelas 7A" className={inputClasses} />
          </Field>

          <div className="mb-4">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
            >
              <Icons.plus size={16} />
              Tambah
            </button>
          </div>
        </form>
      </Card>

      <DayGrid days={days} canEdit={true} />
    </div>
  );
}

async function PesertaSection() {
  await requirePermission("course.manage");
  const board = await getEnrollmentBoard();
  return <PesertaManager {...board} />;
}

async function KelompokSection() {
  await requirePermission("assessment.configure");
  const groups = await getAssessmentGroupBoard();
  return <KelompokManager groups={groups} />;
}

async function BobotSection({ semester, academicYear }: { semester?: string; academicYear?: string }) {
  await requirePermission("assessment.configure");
  const current = getCurrentPeriod();
  const period = {
    semester: semester === Semester.GANJIL || semester === Semester.GENAP ? semester : current.semester,
    academicYear: academicYear && ACADEMIC_YEAR_RE.test(academicYear) ? academicYear : current.academicYear,
  };
  const board = await getGradeWeightBoard(period.semester, period.academicYear);
  return <BobotManager courses={board.courses} period={board.period} periods={board.periods} />;
}

async function PenandaTanganSection() {
  await requirePermission("report.distribute");
  const signatories = await getReportSignatories();
  return <PenandaTanganManager initial={signatories} />;
}

async function AdministrasiSection() {
  await requirePermission("administration.manage");
  const board = await getAdministrationBoard();
  return <AdministrasiManager {...board} />;
}

export default async function AkademikPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; semester?: string; tahun?: string; level?: string; error?: string }>;
}) {
  const [{ tab, semester, tahun, level, error }, user] = await Promise.all([
    searchParams,
    requireAnyPermission([
      "class.manage",
      "course.manage",
      "assessment.configure",
      "administration.manage",
      "report.distribute",
    ]),
  ]);

  const availableTabs = TABS.filter((t) => userCan(user, t.permission));
  if (availableTabs.length === 0) {
    redirect("/dashboard");
  }

  const activeTab = availableTabs.find((t) => t.key === tab)?.key ?? availableTabs[0].key;

  return (
    <div className="view-enter">
      <div className="mb-5">
        <h1 className="text-[26px] font-extrabold tracking-tight">{akademikTitle(user.roles as Role[])}</h1>
        <p className="mt-1 text-sm text-ink-3">Kelola {describeTabs(availableTabs)} dalam satu tempat.</p>
      </div>

      <div className="mb-5 flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {availableTabs.map((t) => (
          <Link
            key={t.key}
            href={`/akademik?tab=${t.key}`}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              activeTab === t.key ? "bg-primary text-white" : "text-ink-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "kelas" ? <KelasSection /> : null}
      {activeTab === "mapel" ? <MapelSection /> : null}
      {activeTab === "jadwal" ? <JadwalSection level={level} error={error} /> : null}
      {activeTab === "peserta" ? <PesertaSection /> : null}
      {activeTab === "kelompok" ? <KelompokSection /> : null}
      {activeTab === "bobot" ? <BobotSection semester={semester} academicYear={tahun} /> : null}
      {activeTab === "penandatangan" ? <PenandaTanganSection /> : null}
      {activeTab === "administrasi" ? <AdministrasiSection /> : null}
    </div>
  );
}
