"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Icons } from "@/components/ui";
import type { AdministrationCheck } from "@/lib/rapor";
import { REPORT_STATUS_HINT } from "../status";
import { approveRaporAction, publishRaporAction, rejectRaporAction } from "../actions";
import type { ReportCardStatus } from "@/generated/prisma/client";

/**
 * Panel administrasi: checklist administrasi santri tampil inline, lalu ACC
 * atau Tolak. Penerbitan adalah langkah terpisah setelah ACC.
 */
export function AdminPanel({
  reportCardId,
  status,
  items,
  initialNote,
  canApprove,
  canDistribute,
}: {
  reportCardId: string;
  status: ReportCardStatus;
  items: AdministrationCheck[];
  initialNote: string;
  canApprove: boolean;
  canDistribute: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();

  const outstanding = items.filter((item) => !item.fulfilled);
  const isSubmitted = status === "SUBMITTED";
  const isApproved = status === "APPROVED";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        alert(res.message || "Tindakan gagal.");
        return;
      }
      alert(success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-2">Panel Administrasi</h2>
        <p className="mt-1 text-[12.5px] text-ink-3">{REPORT_STATUS_HINT[status]}</p>
      </div>

      {/* Checklist administrasi santri */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-2">Checklist Administrasi</span>
          {outstanding.length === 0 ? (
            <Badge tone="success">Lunas</Badge>
          ) : (
            <Badge tone="danger">{outstanding.length} belum terpenuhi</Badge>
          )}
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-2 p-3 text-[13px] text-ink-3">
            Belum ada item administrasi aktif pada periode ini.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    item.fulfilled ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  }`}
                >
                  {item.fulfilled ? <Icons.check2 size={12} /> : <Icons.x size={12} />}
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink-1">{item.name}</div>
                  {item.note ? <div className="text-[12px] text-ink-3">{item.note}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(isSubmitted || isApproved) && canApprove ? (
        <div>
          <label className="mb-2 block text-sm font-semibold text-ink-2">Catatan Administrasi</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending || !isSubmitted}
            rows={3}
            className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-50"
            placeholder="Alasan pengembalian atau catatan ACC..."
          />
        </div>
      ) : null}

      {isSubmitted && canApprove && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <Button
            variant="danger"
            disabled={isPending}
            onClick={() => run(() => rejectRaporAction({ reportCardId, adminNote: note }), "Rapor dikembalikan ke wali kelas.")}
            icon={<Icons.x size={16} />}
          >
            Tolak
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => run(() => approveRaporAction({ reportCardId, adminNote: note }), "Rapor di-ACC.")}
            icon={<Icons.check2 size={16} />}
          >
            ACC Rapor
          </Button>
        </div>
      )}

      {isApproved && canDistribute && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => {
              if (confirm("Terbitkan rapor ini? Setelah terbit rapor tidak bisa diubah dan langsung terlihat wali santri.")) {
                run(() => publishRaporAction(reportCardId), "Rapor berhasil diterbitkan.");
              }
            }}
            icon={<Icons.award size={16} />}
            className="!bg-[oklch(0.58_0.19_142)] text-white hover:!bg-[oklch(0.52_0.19_142)]"
          >
            Terbitkan Rapor
          </Button>
        </div>
      )}

      {outstanding.length > 0 && isSubmitted ? (
        <p className="rounded-xl border border-line bg-danger-soft p-3 text-[12.5px] font-semibold text-danger">
          ACC ditolak selama administrasi belum lunas: {outstanding.map((item) => item.name).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
