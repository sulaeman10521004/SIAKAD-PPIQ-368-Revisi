"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Icons, inputClasses } from "@/components/ui";
import type { AssessmentGroupKind } from "@/generated/prisma/client";
import {
  createAssessmentGroupAction,
  createBehaviorCriterionAction,
  deleteAssessmentGroupAction,
  deleteBehaviorCriterionAction,
  updateAssessmentGroupAction,
  updateBehaviorCriterionAction,
} from "./actions";
import { Modal, Toast, useActionRunner } from "../_components/crud-ui";

type Criterion = { id: string; name: string; maxScore: number; sortOrder: number };
type Group = {
  id: string;
  name: string;
  kind: AssessmentGroupKind;
  defaultMaxScore: number;
  sortOrder: number;
  academicYear: string;
  courseCount: number;
  criteria: Criterion[];
};

const KIND_LABEL: Record<AssessmentGroupKind, string> = { COURSE_SCORE: "Nilai Mata Pelajaran", BEHAVIOR: "Penilaian Sikap" };

function GroupForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Group | null;
  onSave: (data: { name: string; kind: AssessmentGroupKind; defaultMaxScore: number; sortOrder: number; academicYear: string }) => void;
  onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AssessmentGroupKind>(initial?.kind ?? "COURSE_SCORE");
  const [defaultMaxScore, setDefaultMaxScore] = useState(String(initial?.defaultMaxScore ?? 7));
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? `${currentYear}/${currentYear + 1}`);
  const valid = Boolean(name.trim()) && Number(defaultMaxScore) > 0 && (initial || /^\d{4}\/\d{4}$/.test(academicYear));

  return (
    <Modal title={initial ? "Edit Kelompok Penilaian" : "Tambah Kelompok Penilaian"} onClose={onClose}>
      <Field label="Nama kelompok">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth. Nilai Ujian Tulis" className={inputClasses} />
      </Field>
      <Field label="Jenis">
        <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentGroupKind)} className={inputClasses}>
          <option value="COURSE_SCORE">Nilai Mata Pelajaran</option>
          <option value="BEHAVIOR">Penilaian Sikap</option>
        </select>
      </Field>
      <Field label="Nilai maksimal bawaan">
        <input value={defaultMaxScore} onChange={(e) => setDefaultMaxScore(e.target.value.replace(/[^0-9]/g, ""))} className={inputClasses} />
      </Field>
      <Field label="Urutan tampil">
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))} className={inputClasses} />
      </Field>
      {!initial ? (
        <Field label="Tahun ajaran">
          <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026/2027" className={inputClasses} />
        </Field>
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
            onSave({
              name: name.trim(),
              kind,
              defaultMaxScore: Number(defaultMaxScore),
              sortOrder: Number(sortOrder),
              academicYear,
            })
          }
        >
          {initial ? "Simpan Perubahan" : "Tambah Kelompok"}
        </Button>
      </div>
    </Modal>
  );
}

function CriterionForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Criterion | null;
  onSave: (data: { name: string; maxScore: number; sortOrder: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [maxScore, setMaxScore] = useState(String(initial?.maxScore ?? 7));
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const valid = Boolean(name.trim()) && Number(maxScore) > 0;

  return (
    <Modal title={initial ? "Edit Kriteria Sikap" : "Tambah Kriteria Sikap"} width={400} onClose={onClose}>
      <Field label="Nama kriteria">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth. Kedisiplinan" className={inputClasses} />
      </Field>
      <Field label="Nilai maksimal">
        <input value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/[^0-9]/g, ""))} className={inputClasses} />
      </Field>
      <Field label="Urutan tampil">
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))} className={inputClasses} />
      </Field>
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          disabled={!valid}
          className={!valid ? "opacity-50" : ""}
          onClick={() => onSave({ name: name.trim(), maxScore: Number(maxScore), sortOrder: Number(sortOrder) })}
        >
          {initial ? "Simpan Perubahan" : "Tambah Kriteria"}
        </Button>
      </div>
    </Modal>
  );
}

export function KelompokManager({ groups }: { groups: Group[] }) {
  const { run, toast } = useActionRunner();
  const [groupModal, setGroupModal] = useState<{ type: "add" | "edit"; group?: Group } | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [criterionModal, setCriterionModal] = useState<{ groupId: string; type: "add" | "edit"; criterion?: Criterion } | null>(null);
  const [deleteCriterion, setDeleteCriterion] = useState<{ groupId: string; criterion: Criterion } | null>(null);

  const deletingGroup = groups.find((g) => g.id === deleteGroupId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Kelompok Penilaian</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Kelola kelompok penilaian rapor dan kriteria penilaian sikap.</p>
        </div>
        <Button variant="primary" icon={<Icons.plus size={17} />} onClick={() => setGroupModal({ type: "add" })}>
          Tambah Kelompok
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada kelompok penilaian.</p>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.id} pad={20}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold tracking-tight">{g.name}</h3>
                  <Badge tone={g.kind === "BEHAVIOR" ? "accent" : "primary"}>{KIND_LABEL[g.kind]}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  Maks bawaan {g.defaultMaxScore} · Urutan {g.sortOrder} · {g.academicYear} · {g.courseCount} mapel memakai kelompok ini
                </p>
              </div>
              <div className="inline-flex gap-1">
                <button
                  title="Edit"
                  aria-label={`Edit ${g.name}`}
                  onClick={() => setGroupModal({ type: "edit", group: g })}
                  className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                >
                  <Icons.edit size={16} />
                </button>
                <button
                  title="Hapus"
                  aria-label={`Hapus ${g.name}`}
                  onClick={() => setDeleteGroupId(g.id)}
                  className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                >
                  <Icons.trash size={16} />
                </button>
              </div>
            </div>

            {g.kind === "BEHAVIOR" ? (
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink-2">Kriteria Sikap</span>
                  <Button variant="soft" size="sm" icon={<Icons.plus size={14} />} onClick={() => setCriterionModal({ groupId: g.id, type: "add" })}>
                    Tambah Kriteria
                  </Button>
                </div>
                {g.criteria.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">Belum ada kriteria pada kelompok ini.</p>
                ) : (
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {g.criteria.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-[12px] text-ink-3">Maks {c.maxScore} · Urutan {c.sortOrder}</div>
                        </div>
                        <div className="inline-flex gap-1">
                          <button
                            title="Edit"
                            aria-label={`Edit ${c.name}`}
                            onClick={() => setCriterionModal({ groupId: g.id, type: "edit", criterion: c })}
                            className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                          >
                            <Icons.edit size={15} />
                          </button>
                          <button
                            title="Hapus"
                            aria-label={`Hapus ${c.name}`}
                            onClick={() => setDeleteCriterion({ groupId: g.id, criterion: c })}
                            className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                          >
                            <Icons.trash size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        ))
      )}

      {groupModal ? (
        <GroupForm
          initial={groupModal.type === "edit" ? groupModal.group ?? null : null}
          onClose={() => setGroupModal(null)}
          onSave={(data) => {
            if (groupModal.type === "edit" && groupModal.group) {
              run(updateAssessmentGroupAction({ id: groupModal.group.id, ...data }), "Kelompok penilaian diperbarui");
            } else {
              run(createAssessmentGroupAction(data), `Kelompok "${data.name}" ditambahkan`);
            }
            setGroupModal(null);
          }}
        />
      ) : null}

      {deletingGroup ? (
        <Modal title="Hapus Kelompok Penilaian?" onClose={() => setDeleteGroupId(null)} width={420}>
          <p className="text-sm leading-relaxed text-ink-2">
            Kelompok <strong className="text-ink">{deletingGroup.name}</strong> akan dihapus permanen
            {deletingGroup.courseCount > 0 ? ` (masih dipakai ${deletingGroup.courseCount} mapel, hapus akan ditolak)` : ""}.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteGroupId(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              onClick={() => {
                run(deleteAssessmentGroupAction(deletingGroup.id), `Kelompok "${deletingGroup.name}" dihapus`, "warn");
                setDeleteGroupId(null);
              }}
            >
              Ya, Hapus
            </Button>
          </div>
        </Modal>
      ) : null}

      {criterionModal ? (
        <CriterionForm
          initial={criterionModal.type === "edit" ? criterionModal.criterion ?? null : null}
          onClose={() => setCriterionModal(null)}
          onSave={(data) => {
            if (criterionModal.type === "edit" && criterionModal.criterion) {
              run(updateBehaviorCriterionAction({ id: criterionModal.criterion.id, ...data }), "Kriteria diperbarui");
            } else {
              run(createBehaviorCriterionAction({ groupId: criterionModal.groupId, ...data }), `Kriteria "${data.name}" ditambahkan`);
            }
            setCriterionModal(null);
          }}
        />
      ) : null}

      {deleteCriterion ? (
        <Modal title="Hapus Kriteria?" onClose={() => setDeleteCriterion(null)} width={380}>
          <p className="text-sm leading-relaxed text-ink-2">
            Kriteria <strong className="text-ink">{deleteCriterion.criterion.name}</strong> akan dihapus permanen.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteCriterion(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              onClick={() => {
                run(deleteBehaviorCriterionAction(deleteCriterion.criterion.id), `Kriteria "${deleteCriterion.criterion.name}" dihapus`, "warn");
                setDeleteCriterion(null);
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
