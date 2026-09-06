"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Icons, inputClasses } from "@/components/ui";
import type { Semester } from "@/generated/prisma/client";
import {
  createAdministrationItemAction,
  deleteAdministrationItemAction,
  setStudentAdministrationAction,
  updateAdministrationItemAction,
} from "./actions";
import { Modal, Toast, useActionRunner } from "../_components/crud-ui";

type Item = {
  id: string;
  name: string;
  description: string | null;
  academicYear: string;
  semester: Semester;
  sortOrder: number;
  active: boolean;
};
type Student = { id: string; name: string; studentNumber: string; className: string };
type Record_ = { studentId: string; itemId: string; fulfilled: boolean; note: string | null; updatedByName: string | null; updatedAt: string | Date };

const SEMESTER_LABEL: Record<Semester, string> = { GANJIL: "Ganjil", GENAP: "Genap" };

function ItemForm({ initial, onSave, onClose }: { initial: Item | null; onSave: (data: Omit<Item, "id">) => void; onClose: () => void }) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? `${currentYear}/${currentYear + 1}`);
  const [semester, setSemester] = useState<Semester>(initial?.semester ?? "GANJIL");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const valid = Boolean(name.trim()) && /^\d{4}\/\d{4}$/.test(academicYear);

  return (
    <Modal title={initial ? "Edit Item Administrasi" : "Tambah Item Administrasi"} onClose={onClose}>
      <Field label="Nama item">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth. SPP Juli 2026" className={inputClasses} />
      </Field>
      <Field label="Deskripsi (opsional)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClasses} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tahun ajaran">
          <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026/2027" className={inputClasses} />
        </Field>
        <Field label="Semester">
          <select value={semester} onChange={(e) => setSemester(e.target.value as Semester)} className={inputClasses}>
            <option value="GANJIL">Ganjil</option>
            <option value="GENAP">Genap</option>
          </select>
        </Field>
      </div>
      <Field label="Urutan tampil">
        <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))} className={inputClasses} />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-2">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-line-strong accent-primary" />
        Aktif (ditagihkan ke santri)
      </label>
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          disabled={!valid}
          className={!valid ? "opacity-50" : ""}
          onClick={() => onSave({ name: name.trim(), description: description.trim() || null, academicYear, semester, sortOrder: Number(sortOrder), active })}
        >
          {initial ? "Simpan Perubahan" : "Tambah Item"}
        </Button>
      </div>
    </Modal>
  );
}

function RecordModal({
  student,
  item,
  record,
  onSave,
  onClose,
}: {
  student: Student;
  item: Item;
  record: Record_ | null;
  onSave: (data: { fulfilled: boolean; note: string }) => void;
  onClose: () => void;
}) {
  const [fulfilled, setFulfilled] = useState(record?.fulfilled ?? false);
  const [note, setNote] = useState(record?.note ?? "");

  return (
    <Modal title="Checklist Administrasi" sub={`${student.name} · ${item.name}`} onClose={onClose} width={420}>
      <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={fulfilled} onChange={(e) => setFulfilled(e.target.checked)} className="h-4 w-4 rounded border-line-strong accent-primary" />
        Terpenuhi
      </label>
      <Field label="Catatan (opsional)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="cth. Sudah bayar tanggal 5" className={inputClasses} />
      </Field>
      {record?.updatedByName ? <p className="mb-4 text-[12px] text-ink-3">Terakhir diperbarui oleh {record.updatedByName}.</p> : null}
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button variant="primary" onClick={() => onSave({ fulfilled, note })}>
          Simpan
        </Button>
      </div>
    </Modal>
  );
}

export function AdministrasiManager({ items, students, records }: { items: Item[]; students: Student[]; records: Record_[] }) {
  const { run, toast } = useActionRunner();
  const [itemModal, setItemModal] = useState<{ type: "add" | "edit"; item?: Item } | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [cell, setCell] = useState<{ student: Student; item: Item } | null>(null);

  const recordFor = (studentId: string, itemId: string) => records.find((r) => r.studentId === studentId && r.itemId === itemId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Administrasi Santri</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Kelola item administrasi wajib dan pantau pemenuhan tiap santri.</p>
        </div>
        <Button variant="primary" icon={<Icons.plus size={17} />} onClick={() => setItemModal({ type: "add" })}>
          Tambah Item
        </Button>
      </div>

      <Card pad={0} className="overflow-hidden">
        <div className="divide-y divide-line">
          {items.length === 0 ? (
            <p className="p-10 text-center text-sm text-ink-3">Belum ada item administrasi.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{it.name}</span>
                    <Badge tone={it.active ? "success" : "neutral"}>{it.active ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-3">
                    {SEMESTER_LABEL[it.semester]} {it.academicYear} · Urutan {it.sortOrder}
                    {it.description ? ` · ${it.description}` : ""}
                  </div>
                </div>
                <div className="inline-flex gap-1">
                  <button
                    title="Edit"
                    aria-label={`Edit ${it.name}`}
                    onClick={() => setItemModal({ type: "edit", item: it })}
                    className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                  >
                    <Icons.edit size={16} />
                  </button>
                  <button
                    title="Hapus"
                    aria-label={`Hapus ${it.name}`}
                    onClick={() => setDeleteItem(it)}
                    className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  >
                    <Icons.trash size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div>
        <h3 className="mb-3 text-[15px] font-bold tracking-tight">Pemenuhan per Santri</h3>
        {items.length === 0 || students.length === 0 ? (
          <Card pad={30}>
            <p className="text-center text-sm text-ink-3">Tambahkan item administrasi dan pastikan santri sudah terdaftar.</p>
          </Card>
        ) : (
          <Card pad={0} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 480 + items.length * 160 }}>
                <thead>
                  <tr className="bg-surface-2 text-xs font-bold uppercase tracking-wide text-ink-2">
                    <th className="sticky left-0 z-[2] min-w-[200px] bg-surface-2 px-3.5 py-3 text-left">Santri</th>
                    {items.map((it) => (
                      <th key={it.id} className="min-w-[160px] px-3.5 py-3 text-left">
                        {it.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-line hover:bg-surface-2/20">
                      <td className="sticky left-0 z-[1] bg-surface px-3.5 py-3">
                        <div className="text-sm font-semibold">{s.name}</div>
                        <div className="text-[12px] text-ink-3">
                          {s.studentNumber} · {s.className}
                        </div>
                      </td>
                      {items.map((it) => {
                        const rec = recordFor(s.id, it.id);
                        const fulfilled = rec?.fulfilled ?? false;
                        return (
                          <td key={it.id} className="px-3.5 py-3">
                            <button
                              title={rec?.note ?? (fulfilled ? "Terpenuhi" : "Belum terpenuhi")}
                              onClick={() => setCell({ student: s, item: it })}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                fulfilled ? "bg-success-soft text-[oklch(0.42_0.13_150)]" : "bg-danger-soft text-[oklch(0.46_0.16_25)]"
                              }`}
                            >
                              {fulfilled ? <Icons.check2 size={13} /> : <Icons.x size={13} />}
                              {fulfilled ? "Terpenuhi" : "Belum"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {itemModal ? (
        <ItemForm
          initial={itemModal.type === "edit" ? itemModal.item ?? null : null}
          onClose={() => setItemModal(null)}
          onSave={(data) => {
            if (itemModal.type === "edit" && itemModal.item) {
              run(updateAdministrationItemAction({ id: itemModal.item.id, ...data }), "Item administrasi diperbarui");
            } else {
              run(createAdministrationItemAction(data), `${data.name} ditambahkan`);
            }
            setItemModal(null);
          }}
        />
      ) : null}

      {deleteItem ? (
        <Modal title="Hapus Item Administrasi?" onClose={() => setDeleteItem(null)} width={420}>
          <p className="text-sm leading-relaxed text-ink-2">
            Item <strong className="text-ink">{deleteItem.name}</strong> beserta seluruh catatan pemenuhannya akan dihapus permanen.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteItem(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              onClick={() => {
                run(deleteAdministrationItemAction(deleteItem.id), `${deleteItem.name} dihapus`, "warn");
                setDeleteItem(null);
              }}
            >
              Ya, Hapus
            </Button>
          </div>
        </Modal>
      ) : null}

      {cell ? (
        <RecordModal
          student={cell.student}
          item={cell.item}
          record={recordFor(cell.student.id, cell.item.id)}
          onClose={() => setCell(null)}
          onSave={(data) => {
            run(
              setStudentAdministrationAction({ studentId: cell.student.id, itemId: cell.item.id, ...data }),
              `Checklist ${cell.student.name} diperbarui`,
            );
            setCell(null);
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
