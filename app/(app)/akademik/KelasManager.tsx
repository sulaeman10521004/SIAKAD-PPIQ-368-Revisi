"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Icons, inputClasses } from "@/components/ui";
import type { EducationLevel } from "@/generated/prisma/client";
import {
  assignHomeroomAction,
  createClassAction,
  deleteClassAction,
  placeStudentAction,
  removeStudentFromClassAction,
  updateClassAction,
} from "./actions";
import { Modal, Toast, useActionRunner } from "../_components/crud-ui";

type ClassRow = {
  id: string;
  name: string;
  level: EducationLevel;
  academicYear: string;
  homeroomTeacherId: string | null;
  homeroomTeacherName: string | null;
  students: { id: string; name: string; studentNumber: string; level: EducationLevel }[];
};
type UnassignedStudent = { id: string; name: string; studentNumber: string; level: EducationLevel; className: string };
type HomeroomCandidate = { id: string; name: string };

const LEVELS: EducationLevel[] = ["SD", "SMP", "SMA"];

function ClassForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: ClassRow | null;
  onClose: () => void;
  onSaved: (data: { name: string; level: EducationLevel; academicYear: string }) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState<EducationLevel>(initial?.level ?? "SMP");
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? `${currentYear}/${currentYear + 1}`);
  const valid = Boolean(name.trim()) && /^\d{4}\/\d{4}$/.test(academicYear);

  return (
    <Modal
      title={initial ? "Edit Kelas" : "Tambah Kelas"}
      sub={initial ? undefined : "Buat kelas baru untuk menampung santri dan mata pelajaran."}
      onClose={onClose}
    >
      <Field label="Nama kelas">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth. SMP-1" className={inputClasses} />
      </Field>
      <Field label="Jenjang">
        <select value={level} onChange={(e) => setLevel(e.target.value as EducationLevel)} className={inputClasses}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tahun ajaran">
        <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026/2027" className={inputClasses} />
      </Field>
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" disabled={!valid} className={!valid ? "opacity-50" : ""} onClick={() => onSaved({ name: name.trim(), level, academicYear })}>
          {initial ? "Simpan Perubahan" : "Tambah Kelas"}
        </Button>
      </div>
    </Modal>
  );
}

export function KelasManager({
  classes,
  unassignedStudents,
  homeroomCandidates,
}: {
  classes: ClassRow[];
  unassignedStudents: UnassignedStudent[];
  homeroomCandidates: HomeroomCandidate[];
}) {
  const { run, toast } = useActionRunner();
  const [addOpen, setAddOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [pickByClass, setPickByClass] = useState<Record<string, string>>({});

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0) + unassignedStudents.length;
  const deletingClass = classes.find((c) => c.id === deleteClassId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Kelas</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Kelola kelas, wali kelas, dan penempatan santri.</p>
        </div>
        <Button variant="primary" icon={<Icons.plus size={17} />} onClick={() => setAddOpen(true)}>
          Tambah Kelas
        </Button>
      </div>

      <Card pad={0} className="overflow-hidden">
        <div className="grid grid-cols-3 gap-px bg-line">
          <div className="bg-surface p-4">
            <div className="text-2xl font-extrabold leading-none tracking-tight">{classes.length}</div>
            <div className="mt-1 text-[12.5px] text-ink-3">Total Kelas</div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-2xl font-extrabold leading-none tracking-tight">{totalStudents}</div>
            <div className="mt-1 text-[12.5px] text-ink-3">Total Santri</div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: unassignedStudents.length ? "var(--amber)" : undefined }}>
              {unassignedStudents.length}
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">Belum Berkelas</div>
          </div>
        </div>
      </Card>

      {classes.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada kelas. Tambahkan kelas pertama untuk mulai menempatkan santri.</p>
        </Card>
      ) : (
        classes.map((cls) => {
          const pick = pickByClass[cls.id] ?? "";
          return (
            <Card key={cls.id} pad={20}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[16px] font-bold tracking-tight">{cls.name}</h3>
                  <Badge tone="primary">{cls.level}</Badge>
                  <Badge tone="neutral">{cls.academicYear}</Badge>
                  <Badge tone="success">{cls.students.length} santri</Badge>
                </div>
                <div className="inline-flex gap-1">
                  <button
                    title="Edit"
                    aria-label={`Edit ${cls.name}`}
                    onClick={() => setEditingClass(cls)}
                    className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                  >
                    <Icons.edit size={16} />
                  </button>
                  <button
                    title="Hapus"
                    aria-label={`Hapus ${cls.name}`}
                    onClick={() => setDeleteClassId(cls.id)}
                    className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  >
                    <Icons.trash size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Wali kelas</span>
                  <select
                    defaultValue={cls.homeroomTeacherId ?? ""}
                    onChange={(e) =>
                      run(
                        assignHomeroomAction({ classId: cls.id, teacherId: e.target.value || null }),
                        e.target.value ? "Wali kelas diperbarui" : "Wali kelas dikosongkan",
                      )
                    }
                    className={inputClasses}
                  >
                    <option value="">Belum ditugaskan</option>
                    {homeroomCandidates.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Tempatkan santri</span>
                  <div className="flex gap-2">
                    <select
                      value={pick}
                      onChange={(e) => setPickByClass((prev) => ({ ...prev, [cls.id]: e.target.value }))}
                      className={inputClasses}
                      disabled={unassignedStudents.length === 0}
                    >
                      <option value="">{unassignedStudents.length ? "Pilih santri…" : "Semua santri sudah berkelas"}</option>
                      {unassignedStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.studentNumber})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="soft"
                      disabled={!pick}
                      className={!pick ? "opacity-50" : ""}
                      onClick={() => {
                        run(placeStudentAction({ studentId: pick, classId: cls.id }), "Santri ditempatkan");
                        setPickByClass((prev) => ({ ...prev, [cls.id]: "" }));
                      }}
                    >
                      Tempatkan
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {cls.students.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">Belum ada santri di kelas ini.</p>
                ) : (
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {cls.students.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div>
                          <div className="text-sm font-semibold">{s.name}</div>
                          <div className="text-[12px] text-ink-3">{s.studentNumber}</div>
                        </div>
                        <button
                          title="Keluarkan dari kelas"
                          aria-label={`Keluarkan ${s.name} dari kelas`}
                          onClick={() => run(removeStudentFromClassAction(s.id), `${s.name} dikeluarkan dari kelas`, "warn")}
                          className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                        >
                          <Icons.x size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}

      {unassignedStudents.length > 0 ? (
        <Card pad={20} className="border-warning/40">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[15px] font-bold tracking-tight">Santri Belum Berkelas</h3>
            <Badge tone="warning">{unassignedStudents.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedStudents.map((s) => (
              <Badge key={s.id} tone="neutral">
                {s.name} · {s.studentNumber}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {addOpen ? (
        <ClassForm
          initial={null}
          onClose={() => setAddOpen(false)}
          onSaved={(data) => {
            run(createClassAction(data), `Kelas ${data.name} ditambahkan`);
            setAddOpen(false);
          }}
        />
      ) : null}

      {editingClass ? (
        <ClassForm
          initial={editingClass}
          onClose={() => setEditingClass(null)}
          onSaved={(data) => {
            run(updateClassAction({ classId: editingClass.id, ...data }), `Kelas ${data.name} diperbarui`);
            setEditingClass(null);
          }}
        />
      ) : null}

      {deletingClass ? (
        <Modal title="Hapus Kelas?" onClose={() => setDeleteClassId(null)} width={420}>
          <p className="text-sm leading-relaxed text-ink-2">
            Kelas <strong className="text-ink">{deletingClass.name}</strong> akan dihapus permanen. Kelas hanya bisa
            dihapus jika sudah tidak ada santri maupun mata pelajaran yang masih ditempatkan di kelas ini.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteClassId(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              onClick={() => {
                run(deleteClassAction(deletingClass.id), `Kelas ${deletingClass.name} dihapus`, "warn");
                setDeleteClassId(null);
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
