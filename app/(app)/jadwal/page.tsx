import Link from "next/link";
import { requireAnyPermission, userCan } from "@/lib/auth";
import { EducationLevel } from "@/generated/prisma/client";
import { getCourseOverview, getParentScheduleBoard, getScheduleBoard } from "@/lib/lms";
import { Badge, Card } from "@/components/ui";
import { DataExportButtons } from "@/components/DataExportButtons";
import { DayGrid, type Day } from "./ScheduleList";
import { CourseCatalogue } from "./CourseCatalogue";
import { LEVEL_LABEL, LEVEL_FULL, LEVELS } from "@/lib/brand";

const SCHEDULE_COLUMNS = [
  { key: "day", label: "Hari" },
  { key: "time", label: "Jam" },
  { key: "course", label: "Mata Pelajaran" },
  { key: "teacher", label: "Pengajar" },
  { key: "room", label: "Tempat" },
];

function scheduleRows(days: Day[]) {
  return [1, 2, 3, 4, 5, 6, 0].flatMap((dayIndex) =>
    days[dayIndex].slots.map((slot) => ({
      day: days[dayIndex].label,
      time: `${slot.startTime} - ${slot.endTime}`,
      course: slot.courseTitle,
      teacher: slot.teacher,
      room: slot.room,
    })),
  );
}

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; anak?: string }>;
}) {
  const [{ level, anak }, user] = await Promise.all([
    searchParams,
    requireAnyPermission(["course.view", "schedule.view.own"]),
  ]);

  const canViewCourses = userCan(user, "course.view");

  /* ------------------------------ wali santri ------------------------------ */

  if (!canViewCourses) {
    const children = await getParentScheduleBoard(user.id);

    if (children.length === 0) {
      return (
        <div className="view-enter flex flex-col" style={{ gap: 20 }}>
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight">Jadwal Pelajaran</h1>
            <p className="mt-1 text-sm text-ink-3">Jadwal pelajaran anak Anda per pekan.</p>
          </div>
          <Card pad={40}>
            <p className="text-center text-sm text-ink-3">
              Belum ada anak yang terdaftar. Ajukan lewat menu{" "}
              <Link href="/pendaftaran" className="font-semibold text-primary-700 underline underline-offset-4">
                Pendaftaran
              </Link>
              .
            </p>
          </Card>
        </div>
      );
    }

    const activeChild = children.find((c) => c.childId === anak) ?? children[0];

    return (
      <div className="view-enter flex flex-col" style={{ gap: 20 }}>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Jadwal Pelajaran</h1>
          <p className="mt-1 text-sm text-ink-3">Jadwal pelajaran anak Anda per pekan.</p>
        </div>

        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {children.map((c) => {
              const active = c.childId === activeChild.childId;
              return (
                <Link
                  key={c.childId}
                  href={`/jadwal?anak=${c.childId}`}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                    active ? "border-transparent bg-primary text-white" : "border-line bg-surface text-ink-2"
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <Badge tone="primary">Kelas {activeChild.className}</Badge>
            <span className="font-semibold">{activeChild.name}</span>
            <span className="text-ink-4">•</span>
            <span>{LEVEL_FULL[activeChild.level]}</span>
          </div>
          <DataExportButtons
            title={`Jadwal Pelajaran ${activeChild.name}`}
            fileName={`jadwal-${activeChild.name}-${activeChild.className}`}
            meta={{ Santri: activeChild.name, Kelas: activeChild.className, Jenjang: activeChild.level }}
            columns={SCHEDULE_COLUMNS}
            rows={scheduleRows(activeChild.days)}
          />
        </div>

        <DayGrid days={activeChild.days} canEdit={false} />
      </div>
    );
  }

  /* ------------------------- staf, mudir, dan ustadz ------------------------ */

  const canManageAcademics = userCan(user, "course.manage");

  const activeLevel = Object.values(EducationLevel).includes(level as EducationLevel)
    ? (level as EducationLevel)
    : EducationLevel.SMP;
  const [{ days }, courseOverview] = await Promise.all([getScheduleBoard(user, activeLevel), getCourseOverview(user)]);

  const unassignedCourses = canManageAcademics ? courseOverview.filter((course) => !course.assigned).length : 0;

  return (
    <div className="view-enter flex flex-col" style={{ gap: 20 }}>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Jadwal Pelajaran</h1>
        <p className="mt-1 text-sm text-ink-3">
          {canManageAcademics
            ? "Jadwal pelajaran per jenjang. Kelola slot dan mata pelajaran lewat menu Data Akademik."
            : "Jadwal kegiatan belajar mengajar di pondok pesantren."}
        </p>
      </div>

      <div className="flex gap-2 border-b border-line pb-px overflow-x-auto">
        {LEVELS.map((lvl) => {
          const active = lvl === activeLevel;
          return (
            <Link
              key={lvl}
              href={`/jadwal?level=${lvl}`}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${
                active ? "border-primary text-primary" : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {LEVEL_FULL[lvl] === LEVEL_LABEL[lvl] ? LEVEL_LABEL[lvl] : `${LEVEL_FULL[lvl]} (${LEVEL_LABEL[lvl]})`}
            </Link>
          );
        })}
      </div>

      <div className="flex justify-end">
        <DataExportButtons
          title={`Jadwal Pelajaran ${activeLevel}`}
          fileName={`jadwal-${activeLevel}`}
          meta={{ Jenjang: LEVEL_FULL[activeLevel] }}
          columns={SCHEDULE_COLUMNS}
          rows={scheduleRows(days)}
        />
      </div>

      <DayGrid days={days} canEdit={false} />

      {/* --------------------------- mata pelajaran --------------------------- */}
      <div>
        {unassignedCourses > 0 ? (
          <div className="mb-5 rounded-xl border border-line bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
            {unassignedCourses} mata pelajaran lama belum memiliki ustadz pengampu. Buka{" "}
            <Link href="/akademik" className="underline underline-offset-2">
              Data Akademik
            </Link>{" "}
            untuk menugaskannya sebelum dipakai mengisi nilai atau absensi.
          </div>
        ) : null}

        <CourseCatalogue courses={courseOverview} initialLevel={activeLevel} />
      </div>
    </div>
  );
}
