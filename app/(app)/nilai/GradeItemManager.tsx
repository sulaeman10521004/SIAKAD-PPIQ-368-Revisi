"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icons, inputClasses } from "@/components/ui";
import { deleteGradeItemAction, updateGradeItemAction } from "../actions";

type Item = { id: string; title: string; maxScore: number; weight: number; dueAt: string; recordCount: number };

/** Kelola komponen nilai (ubah judul/nilai maks/bobot/tenggat, hapus) khusus pengampu. */
export function GradeItemManager({ items, weightTotal }: { items: Item[]; weightTotal: number }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [weight, setWeight] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(item: Item) {
    setError(null);
    setEditingId(item.id);
    setTitle(item.title);
    setMaxScore(String(item.maxScore));
    setWeight(String(item.weight));
    setDueAt(item.dueAt);
  }

  function save(item: Item) {
    const nextMaxScore = Number.parseInt(maxScore, 10);
    // Mengubah nilai maksimal ikut menskalakan ulang nilai yang sudah tercatat
    // (nilai disimpan pada skala komponennya), jadi konfirmasikan dulu.
    if (Number.isInteger(nextMaxScore) && nextMaxScore !== item.maxScore && item.recordCount > 0) {
      const warning =
        `Ubah nilai maksimal "${item.title}" dari ${item.maxScore} ke ${nextMaxScore}? ` +
        `${item.recordCount} nilai santri yang sudah tercatat akan diskalakan ulang secara proporsional ke skala baru. ` +
        `Hasilnya dibulatkan, sehingga presisi nilai bisa sedikit berkurang${nextMaxScore < item.maxScore ? " (terutama karena skala mengecil)" : ""}.`;
      if (!confirm(warning)) return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateGradeItemAction({
        gradeItemId: item.id,
        title,
        maxScore: nextMaxScore,
        weight: Number.parseInt(weight, 10),
        dueAt,
      });
      if (!res.ok) {
        setError(res.message ?? "Komponen nilai gagal diperbarui.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(item: Item) {
    const warning =
      item.recordCount > 0
        ? `Hapus komponen "${item.title}"? ${item.recordCount} nilai santri pada komponen ini ikut terhapus permanen.`
        : `Hapus komponen "${item.title}"? Belum ada nilai santri pada komponen ini.`;
    if (!confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteGradeItemAction(item.id);
      if (!res.ok) {
        setError(res.message ?? "Komponen nilai gagal dihapus.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  if (items.length === 0) return null;

  return (
    <Card pad={16} className="mb-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-bold">Kelola komponen nilai</div>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Ubah nama, nilai maksimal, bobot, atau tenggat; atau hapus komponen beserta nilainya.</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
          style={{
            background: weightTotal === 100 ? "var(--green-soft)" : "var(--amber-soft)",
            color: weightTotal === 100 ? "var(--green)" : "var(--amber)",
          }}
        >
          Total bobot {weightTotal}%{weightTotal === 100 ? "" : " (idealnya 100%)"}
        </span>
      </div>

      {error ? (
        <div className="mb-2.5 rounded-xl border border-line bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</div>
      ) : null}

      <div className="divide-y divide-line">
        {items.map((item) => (
          <div key={item.id} className="py-2.5">
            {editingId === item.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid gap-2.5 md:grid-cols-[1fr_0.45fr_0.45fr_0.7fr_auto]">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="Nama komponen"
                    placeholder="cth. UH 1"
                    className={inputClasses}
                  />
                  <input
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    aria-label="Nilai maksimal"
                    type="number"
                    min={1}
                    max={1000}
                    className={inputClasses}
                  />
                  <input
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    aria-label="Bobot persen"
                    type="number"
                    min={0}
                    max={100}
                    className={inputClasses}
                  />
                  <input
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    aria-label="Tenggat"
                    type="date"
                    className={inputClasses}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" disabled={isPending} onClick={() => save(item)}>
                      Simpan
                    </Button>
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setEditingId(null)}>
                      Batal
                    </Button>
                  </div>
                </div>
                {item.recordCount > 0 ? (
                  <p className="text-[12px] text-ink-3">
                    Mengubah nilai maksimal akan menskalakan ulang {item.recordCount} nilai santri yang sudah tercatat ke skala baru
                    (dibulatkan, presisi bisa berkurang bila skala diperkecil).
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{item.title}</div>
                  <div className="text-[12px] text-ink-3">
                    Maks {item.maxScore} • bobot {item.weight}% • {item.recordCount} nilai tercatat
                    {item.dueAt ? ` • tenggat ${item.dueAt}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => startEdit(item)}
                  disabled={isPending}
                  title={`Ubah komponen ${item.title}`}
                  aria-label={`Ubah komponen ${item.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-primary-soft hover:text-primary-700 disabled:opacity-50"
                >
                  <Icons.edit size={15} />
                </button>
                <button
                  onClick={() => remove(item)}
                  disabled={isPending}
                  title={`Hapus komponen ${item.title}`}
                  aria-label={`Hapus komponen ${item.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                  <Icons.trash size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
