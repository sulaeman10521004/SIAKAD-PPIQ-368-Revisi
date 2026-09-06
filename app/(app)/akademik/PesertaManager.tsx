"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Icons, inputClasses } from "@/components/ui";
import type { EducationLevel } from "@/generated/prisma/client";
import { setClassEnrollmentAction, setEnrollmentAction } from "./actions";
import { Toast, useActionRunner } from "../_components/crud-ui";

type Student = { id: string; name: string; studentNumber: string };
type CourseRow = {
  id: string;
  title: string;
  teacherName: string | null;
  activeCount: number;
  activeStudentIds: string[];
  inactiveStudentIds: string[];
};
type ClassRow = {
  id: string;
  name: string;
  level: EducationLevel;
  academicYear: string;
  students: Student[];
  courses: CourseRow[];
};

export function PesertaManager({
  classes,
  coursesWithoutClass,
}: {
  classes: ClassRow[];
  coursesWithoutClass: { id: string; title: string }[];
}) {
  const { run, toast, pending } = useActionRunner();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  const cls = classes.find((c) => c.id === classId) ?? classes[0] ?? null;
  const list = useMemo(
    () => (cls ? cls.courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())) : []),
    [cls, q],
  );

  if (!cls) {
    return (
      <Card pad={40}>
        <p className="text-center text-sm text-ink-3">Belum ada kelas. Buat kelas dan tempatkan santri terlebih dahulu di tab Kelas.</p>
      </Card>
    );
  }

  const studentIds = new Set(cls.students.map((s) => s.id));
  const enrolledPairs = cls.courses.reduce(
    (sum, c) => sum + c.activeStudentIds.filter((id) => studentIds.has(id)).length,
    0,
  );
  const totalPairs = cls.students.length * cls.courses.length;
  const fullyEnrolled = totalPairs > 0 && enrolledPairs === totalPairs;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Peserta Mapel</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Daftarkan santri ke mata pelajaran kelasnya. Tanpa pendaftaran ini, absensi, nilai, dan rapor tidak menemukan peserta.
          </p>
        </div>
        {classes.length > 1 ? (
          <select value={cls.id} aria-label="Pilih kelas" onChange={(e) => setClassId(e.target.value)} className={`${inputClasses} sm:max-w-[240px]`}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.academicYear}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <Card pad={0} className="overflow-hidden">
        <div className="grid grid-cols-3 gap-px bg-line">
          <div className="bg-surface p-4">
            <div className="text-2xl font-extrabold leading-none tracking-tight">{cls.students.length}</div>
            <div className="mt-1 text-[12.5px] text-ink-3">Santri {cls.name}</div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-2xl font-extrabold leading-none tracking-tight">{cls.courses.length}</div>
            <div className="mt-1 text-[12.5px] text-ink-3">Mapel Kelas Ini</div>
          </div>
          <div className="bg-surface p-4">
            <div
              className="text-2xl font-extrabold leading-none tracking-tight"
              style={{ color: fullyEnrolled ? "var(--green)" : "var(--amber)" }}
            >
              {enrolledPairs}/{totalPairs}
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">Pendaftaran Aktif</div>
          </div>
        </div>
      </Card>

      <Card pad={20}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">Pendaftaran massal</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Daftarkan seluruh {cls.students.length} santri {cls.name} ke seluruh {cls.courses.length} mapel kelas ini sekaligus.
              Pendaftaran ulang aman dijalankan berkali-kali.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={pending || enrolledPairs === 0}
              className={pending || enrolledPairs === 0 ? "opacity-50" : ""}
              onClick={() => run(setClassEnrollmentAction({ classId: cls.id, enrolled: false }), `Peserta ${cls.name} dikeluarkan`, "warn")}
            >
              Keluarkan Semua
            </Button>
            <Button
              variant="primary"
              disabled={pending || totalPairs === 0}
              className={pending || totalPairs === 0 ? "opacity-50" : ""}
              onClick={() => run(setClassEnrollmentAction({ classId: cls.id, enrolled: true }), `Semua santri ${cls.name} didaftarkan`)}
            >
              Daftarkan Semua
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 sm:max-w-[320px]">
        <Icons.search size={17} style={{ color: "var(--text-3)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari mata pelajaran"
          placeholder="Cari mata pelajaran…"
          className="w-full bg-transparent py-2.5 text-[13.5px] outline-none"
        />
      </div>

      {list.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">
            {cls.courses.length === 0
              ? `Belum ada mata pelajaran yang ditetapkan untuk kelas ${cls.name}. Atur di tab Mapel & Pengampu.`
              : "Tidak ada mata pelajaran yang cocok."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((course) => {
            const active = new Set(course.activeStudentIds);
            const inClass = cls.students.filter((s) => active.has(s.id)).length;
            const expanded = openCourse === course.id;
            return (
              <Card key={course.id} pad={0} className="overflow-hidden">
                <button
                  onClick={() => setOpenCourse(expanded ? null : course.id)}
                  className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{course.title}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{course.teacherName ?? "Pengampu belum ditugaskan"}</div>
                  </div>
                  <Badge tone={inClass === cls.students.length && cls.students.length > 0 ? "success" : "warning"}>
                    {inClass}/{cls.students.length} santri kelas
                  </Badge>
                  <Badge tone="neutral">{course.activeCount} peserta aktif</Badge>
                  <Icons.chevD size={18} style={{ color: "var(--text-3)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>

                {expanded ? (
                  <div className="border-t border-line p-4">
                    {cls.students.length === 0 ? (
                      <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">Belum ada santri di kelas ini.</p>
                    ) : (
                      <div className="divide-y divide-line rounded-xl border border-line">
                        {cls.students.map((s) => {
                          const enrolled = active.has(s.id);
                          return (
                            <div key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                              <div>
                                <div className="text-sm font-semibold">{s.name}</div>
                                <div className="text-[12px] text-ink-3">
                                  {s.studentNumber}
                                  {!enrolled && course.inactiveStudentIds.includes(s.id) ? " · pernah dikeluarkan" : ""}
                                </div>
                              </div>
                              <Button
                                variant={enrolled ? "ghost" : "soft"}
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    setEnrollmentAction({ studentId: s.id, courseId: course.id, enrolled: !enrolled }),
                                    enrolled ? `${s.name} dikeluarkan dari ${course.title}` : `${s.name} didaftarkan ke ${course.title}`,
                                    enrolled ? "warn" : "ok",
                                  )
                                }
                              >
                                {enrolled ? "Keluarkan" : "Daftarkan"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {coursesWithoutClass.length > 0 ? (
        <Card pad={20} className="border-warning/40">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[15px] font-bold tracking-tight">Mapel Tanpa Kelas</h3>
            <Badge tone="warning">{coursesWithoutClass.length}</Badge>
          </div>
          <p className="text-[12.5px] text-ink-3">
            Mata pelajaran berikut belum ditetapkan ke kelas mana pun sehingga tidak bisa didaftarkan massal: {coursesWithoutClass.map((c) => c.title).join(", ")}.
          </p>
        </Card>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
