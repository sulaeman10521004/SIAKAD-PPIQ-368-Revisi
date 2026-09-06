"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Icons } from "@/components/ui";
import type { SheetBehaviorEntry } from "@/lib/rapor";
import { REPORT_STATUS_HINT } from "../status";
import {
  deleteRaporAction,
  generateRaporAction,
  saveBehaviorScoresAction,
  saveHomeroomNoteAction,
  submitRaporAction,
} from "../actions";
import type { ReportCardStatus, Semester } from "@/generated/prisma/client";

/** Panel kerja wali kelas: nilai sikap, catatan, hitung ulang, dan pengiriman. */
export function HomeroomPanel({
  reportCardId,
  studentId,
  semester,
  academicYear,
  status,
  initialNote,
  behaviorEntries,
}: {
  reportCardId: string;
  studentId: string;
  semester: Semester;
  academicYear: string;
  status: ReportCardStatus;
  initialNote: string;
  behaviorEntries: SheetBehaviorEntry[];
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(behaviorEntries.map((entry) => [entry.id, String(entry.scoreValue)])),
  );
  const [isPending, startTransition] = useTransition();

  const editable = status === "DRAFT" || status === "REJECTED";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        alert(res.message || "Tindakan gagal.");
        return;
      }
      if (success) alert(success);
      router.refresh();
    });
  }

  function handleSave() {
    run(async () => {
      const behavior = await saveBehaviorScoresAction({
        reportCardId,
        scores: behaviorEntries.map((entry) => ({ id: entry.id, scoreValue: Number(scores[entry.id] ?? 0) })),
      });
      if (!behavior.ok) return behavior;
      return saveHomeroomNoteAction({ reportCardId, note });
    }, "Perubahan rapor tersimpan.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-2">Panel Wali Kelas</h2>
        <p className="mt-1 text-[12.5px] text-ink-3">{REPORT_STATUS_HINT[status]}</p>
      </div>

      {!editable ? (
        <p className="rounded-xl border border-line bg-surface-2 p-3.5 text-[13px] text-ink-2">
          Rapor terkunci. Anda hanya dapat menyunting saat status Draf atau setelah dikembalikan administrasi.
        </p>
      ) : null}

      {/* Nilai sikap & kedisiplinan (diisi manual) */}
      {behaviorEntries.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-ink-2">Penilaian Sikap dan Kedisiplinan</label>
          <div className="flex flex-col gap-2">
            {behaviorEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-1">
                  {entry.criterionName}
                </span>
                <span className="text-[12px] text-ink-3">maks {entry.maxScore}</span>
                <input
                  type="number"
                  min={0}
                  max={entry.maxScore}
                  value={scores[entry.id] ?? ""}
                  disabled={!editable || isPending}
                  onChange={(e) => setScores((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                  className="w-20 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-center text-sm font-bold text-ink outline-none transition focus:border-primary disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-ink-2">Catatan Wali Kelas</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!editable || isPending}
          rows={4}
          className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-50"
          placeholder="Masukkan catatan perkembangan belajar santri..."
        />
      </div>

      {editable && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="soft" disabled={isPending} onClick={handleSave} icon={<Icons.check2 size={16} />}>
              Simpan Perubahan
            </Button>
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                if (confirm("Hitung ulang nilai rapor dari data nilai & absensi terbaru?")) {
                  run(
                    () => generateRaporAction({ studentId, semester, academicYear }),
                    "Nilai rapor berhasil dihitung ulang.",
                  );
                }
              }}
              icon={<Icons.chart size={16} />}
            >
              Hitung Ulang Nilai
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => {
                if (confirm("Hapus rapor ini? Tindakan ini tidak dapat dibatalkan.")) {
                  startTransition(async () => {
                    const res = await deleteRaporAction(reportCardId);
                    if (!res.ok) alert(res.message || "Gagal menghapus rapor");
                    else router.push("/rapor");
                  });
                }
              }}
              icon={<Icons.trash size={16} />}
            >
              Hapus
            </Button>
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() => {
                if (confirm("Kirim rapor ini ke administrasi? Setelah dikirim rapor tidak bisa disunting.")) {
                  run(() => submitRaporAction(reportCardId), "Rapor dikirim ke administrasi.");
                }
              }}
              icon={<Icons.award size={16} />}
            >
              Kirim ke Administrasi
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
