"use client";

import { useMemo, useState } from "react";
import { Button, Card, Field, Icons, inputClasses } from "@/components/ui";
import type { EducationLevel } from "@/generated/prisma/client";
import { createCourseAction, deleteCourseAction, updateCourseAssignmentAction } from "./actions";
import { Modal, Toast, useActionRunner } from "../_components/crud-ui";

type Course = {
  id: string;
  title: string;
  level: EducationLevel;
  reportMaxScore: number | null;
  classRoomId: string | null;
  className: string | null;
  assessmentGroupId: string | null;
  assessmentGroupName: string | null;
  teacherId: string | null;
  teacherName: string | null;
};
type AssessmentGroupOption = { id: string; name: string; kind: string };
type ClassRoomOption = { id: string; name: string; level: EducationLevel };
type TeacherOption = { id: string; name: string; roles: string[] };

type Draft = { classRoomId: string; assessmentGroupId: string; teacherId: string; reportMaxScore: string };

function draftFrom(c: Course): Draft {
  return {
    classRoomId: c.classRoomId ?? "",
    assessmentGroupId: c.assessmentGroupId ?? "",
    teacherId: c.teacherId ?? "",
    reportMaxScore: c.reportMaxScore === null ? "" : String(c.reportMaxScore),
  };
}

function AddCourseModal({
  onClose,
  onSaved,
  assessmentGroups,
  classRooms,
  teachingStaff,
  canConfigureAssessment,
  canManageClass,
}: {
  onClose: () => void;
  onSaved: (data: {
    title: string;
    description: string;
    level: EducationLevel;
    classRoomId: string | null;
    assessmentGroupId: string | null;
    teacherId: string | null;
    reportMaxScore: number | null;
  }) => void;
  assessmentGroups: AssessmentGroupOption[];
  classRooms: ClassRoomOption[];
  teachingStaff: TeacherOption[];
  canConfigureAssessment: boolean;
  canManageClass: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<EducationLevel>("SMP");
  const [classRoomId, setClassRoomId] = useState("");
  const [assessmentGroupId, setAssessmentGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [reportMaxScore, setReportMaxScore] = useState("");
  const filteredClassRooms = classRooms.filter((classRoom) => classRoom.level === level);
  const valid = Boolean(title.trim()) && Boolean(description.trim());

  return (
    <Modal title="Tambah Mata Pelajaran" sub="Buat mapel baru lalu tetapkan kelas, kelompok penilaian, dan pengampu." onClose={onClose} width={520}>
      <Field label="Nama mapel">
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="cth. Tafsir" className={inputClasses} />
      </Field>
      <Field label="Deskripsi">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ringkasan singkat mapel" className={inputClasses} />
      </Field>
      <Field label="Jenjang">
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as EducationLevel);
            setClassRoomId("");
          }}
          className={inputClasses}
        >
          {(["SD", "SMP", "SMA"] as EducationLevel[]).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      {canManageClass ? (
        <Field label="Kelas">
          <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} className={inputClasses}>
            <option value="">Belum ditentukan</option>
            {filteredClassRooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {canConfigureAssessment ? (
        <Field label="Kelompok penilaian">
          <select value={assessmentGroupId} onChange={(e) => setAssessmentGroupId(e.target.value)} className={inputClasses}>
            <option value="">Belum ditentukan</option>
            {assessmentGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Ustadz pengampu">
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputClasses}>
          <option value="">Belum ditugaskan</option>
            {teachingStaff.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      {canConfigureAssessment ? (
        <Field label="Nilai maksimal rapor (opsional)">
          <input
            value={reportMaxScore}
            onChange={(e) => setReportMaxScore(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="cth. 7 (kosongkan untuk ikut kelompok)"
            className={inputClasses}
          />
        </Field>
      ) : null}
      {!canConfigureAssessment || !canManageClass ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-3">
          Kelas, kelompok penilaian, dan nilai maksimal rapor diatur oleh mudir.
        </p>
      ) : null}
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          disabled={!valid}
          className={!valid ? "opacity-50" : ""}
          onClick={() =>
            onSaved({
              title: title.trim(),
              description: description.trim(),
              level,
              classRoomId: classRoomId || null,
              assessmentGroupId: assessmentGroupId || null,
              teacherId: teacherId || null,
              reportMaxScore: reportMaxScore ? Number(reportMaxScore) : null,
            })
          }
        >
          Tambah Mapel
        </Button>
      </div>
    </Modal>
  );
}

export function MapelManager({
  courses,
  assessmentGroups,
  classRooms,
  teachingStaff,
  canConfigureAssessment,
  canManageClass,
}: {
  courses: Course[];
  assessmentGroups: AssessmentGroupOption[];
  classRooms: ClassRoomOption[];
  teachingStaff: TeacherOption[];
  /** `assessment.configure`: kelompok penilaian & nilai maksimal rapor (mudir). */
  canConfigureAssessment: boolean;
  /** `class.manage`: penempatan mapel ke kelas (mudir). */
  canManageClass: boolean;
}) {
  const { run, toast } = useActionRunner();
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ classRoomId: "", assessmentGroupId: "", teacherId: "", reportMaxScore: "" });
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const deletingCourse = courses.find((c) => c.id === deleteCourseId) ?? null;

  const list = useMemo(
    () =>
      courses.filter(
        (c) =>
          (groupFilter === "ALL" || c.assessmentGroupId === groupFilter) &&
          c.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [courses, q, groupFilter],
  );

  function startEdit(c: Course) {
    setEditingId(c.id);
    setDraft(draftFrom(c));
  }

  function saveEdit(courseId: string) {
    run(
      updateCourseAssignmentAction({
        courseId,
        classRoomId: draft.classRoomId || null,
        assessmentGroupId: draft.assessmentGroupId || null,
        teacherId: draft.teacherId || null,
        reportMaxScore: draft.reportMaxScore ? Number(draft.reportMaxScore) : null,
      }),
      "Mata pelajaran diperbarui",
    );
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Mapel & Pengampu</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {courses.length} mata pelajaran · atur kelas, kelompok penilaian, pengampu, dan nilai maksimal rapor.
          </p>
        </div>
        <Button variant="primary" icon={<Icons.plus size={17} />} onClick={() => setAddOpen(true)}>
          Tambah Mapel
        </Button>
      </div>

      {!canConfigureAssessment || !canManageClass ? (
        <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-ink-2">
          Anda dapat mengatur data mapel dan ustadz pengampu.
          {!canManageClass ? " Penempatan kelas" : ""}
          {!canManageClass && !canConfigureAssessment ? " serta" : ""}
          {!canConfigureAssessment ? " kelompok penilaian dan nilai maksimal rapor" : ""} hanya dapat diubah mudir.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 sm:max-w-[280px]">
          <Icons.search size={17} style={{ color: "var(--text-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari mata pelajaran"
            placeholder="Cari mata pelajaran…"
            className="w-full bg-transparent py-2.5 text-[13.5px] outline-none"
          />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={`${inputClasses} sm:max-w-[260px]`}>
          <option value="ALL">Semua kelompok penilaian</option>
          {assessmentGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <Card pad={0} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <thead>
              <tr className="bg-surface-2 text-xs font-bold uppercase tracking-wide text-ink-2">
                <th className="sticky left-0 z-[2] min-w-[180px] bg-surface-2 px-3.5 py-3 text-left">Mapel</th>
                <th className="px-3.5 py-3 text-left">Kelas</th>
                <th className="px-3.5 py-3 text-left">Kelompok Penilaian</th>
                <th className="px-3.5 py-3 text-left">Pengampu</th>
                <th className="px-3.5 py-3 text-left">Maks Rapor</th>
                <th className="px-3.5 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const editing = editingId === c.id;
                return (
                  <tr key={c.id} className="border-t border-line hover:bg-surface-2/20">
                    <td className="sticky left-0 z-[1] bg-surface px-3.5 py-3">
                      <div className="text-sm font-semibold">{c.title}</div>
                      <div className="text-[12px] text-ink-3">{c.level}</div>
                    </td>
                    <td className="px-3.5 py-3">
                      {editing && canManageClass ? (
                        <select value={draft.classRoomId} onChange={(e) => setDraft((d) => ({ ...d, classRoomId: e.target.value }))} className={inputClasses}>
                          <option value="">-</option>
                          {classRooms.filter((cr) => cr.level === c.level).map((cr) => (
                            <option key={cr.id} value={cr.id}>
                              {cr.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        c.className ?? <span className="text-ink-3">-</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {editing && canConfigureAssessment ? (
                        <select
                          value={draft.assessmentGroupId}
                          onChange={(e) => setDraft((d) => ({ ...d, assessmentGroupId: e.target.value }))}
                          className={inputClasses}
                        >
                          <option value="">-</option>
                          {assessmentGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        c.assessmentGroupName ?? <span className="text-ink-3">-</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {editing ? (
                        <select value={draft.teacherId} onChange={(e) => setDraft((d) => ({ ...d, teacherId: e.target.value }))} className={inputClasses}>
                          <option value="">Belum ditugaskan</option>
                          {teachingStaff.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        c.teacherName ?? <span className="text-ink-3">Belum ditugaskan</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {editing && canConfigureAssessment ? (
                        <input
                          value={draft.reportMaxScore}
                          onChange={(e) => setDraft((d) => ({ ...d, reportMaxScore: e.target.value.replace(/[^0-9]/g, "") }))}
                          placeholder="ikut kelompok"
                          className={`${inputClasses} max-w-[110px]`}
                        />
                      ) : (
                        c.reportMaxScore ?? <span className="text-ink-3">ikut kelompok</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      {editing ? (
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            Batal
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => saveEdit(c.id)}>
                            Simpan
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          <button
                            title="Edit"
                            aria-label={`Edit ${c.title}`}
                            onClick={() => startEdit(c)}
                            className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                          >
                            <Icons.edit size={16} />
                          </button>
                          <button
                            title="Hapus"
                            aria-label={`Hapus ${c.title}`}
                            onClick={() => setDeleteCourseId(c.id)}
                            className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                          >
                            <Icons.trash size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? <div className="p-10 text-center text-sm text-ink-3">Tidak ada mata pelajaran yang cocok.</div> : null}
      </Card>

      {addOpen ? (
        <AddCourseModal
          onClose={() => setAddOpen(false)}
          assessmentGroups={assessmentGroups}
          classRooms={classRooms}
          teachingStaff={teachingStaff}
          canConfigureAssessment={canConfigureAssessment}
          canManageClass={canManageClass}
          onSaved={(data) => {
            run(createCourseAction(data), `${data.title} ditambahkan`);
            setAddOpen(false);
          }}
        />
      ) : null}

      {deletingCourse ? (
        <Modal title="Hapus Mata Pelajaran?" onClose={() => setDeleteCourseId(null)} width={440}>
          <p className="text-sm leading-relaxed text-ink-2">
            Mapel <strong className="text-ink">{deletingCourse.title}</strong> akan disembunyikan dari daftar mapel
            aktif. Riwayat nilai, absensi, dan rapor yang sudah ada untuk mapel ini tetap tersimpan dan tidak
            terhapus.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteCourseId(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              onClick={() => {
                run(deleteCourseAction(deletingCourse.id), `Mapel ${deletingCourse.title} dihapus`, "warn");
                setDeleteCourseId(null);
              }}
            >
              Ya, Hapus
            </Button>
          </div>
        </Modal>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
