"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Card, scoreColor } from "@/components/ui";
import { PASS_THRESHOLD } from "@/components/ui";
import { saveGradeAction } from "../actions";

type Column = { id: string; title: string; maxScore: number };
type Row = { studentId: string; name: string; studentNumber: string; scores: (number | null)[]; avg: number };

export function Gradebook({ columns, rows, canEdit }: { columns: Column[]; rows: Row[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ studentId: string; col: number } | null>(null);
  const [, startTransition] = useTransition();

  function save(gradeItemId: string, studentId: string, raw: string) {
    setEditing(null);
    const value = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
    startTransition(async () => {
      await saveGradeAction({ gradeItemId, studentId, value });
      router.refresh();
    });
  }

  if (columns.length === 0) {
    return (
      <Card pad={40}>
        <p className="text-center text-sm text-ink-3">Belum ada komponen nilai di kelas ini.</p>
      </Card>
    );
  }

  return (
    <Card pad={0} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 680 }}>
          <thead>
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-[2] min-w-[200px] bg-surface-2 px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-2">
                Santri
              </th>
              {columns.map((c) => (
                <th key={c.id} className="px-3.5 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2 whitespace-nowrap">
                  {c.title}
                </th>
              ))}
              <th className="px-3.5 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2">Rata²</th>
              <th className="px-3.5 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.studentId} className="border-t border-line">
                <td className="sticky left-0 z-[1] bg-surface px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 text-right text-[12px] font-semibold text-ink-3">{ri + 1}</span>
                    <Avatar initials={r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} color="var(--primary)" size={30} />
                    <div className="min-w-0">
                      <div className="whitespace-nowrap text-[13.5px] font-semibold">{r.name}</div>
                      <div className="mono text-[11px] text-ink-3">{r.studentNumber}</div>
                    </div>
                  </div>
                </td>
                {r.scores.map((sc, ci) => {
                  const isEd = editing?.studentId === r.studentId && editing.col === ci;
                  return (
                    <td key={ci} className="px-3.5 py-2.5 text-center">
                      {isEd ? (
                        <input
                          autoFocus
                          type="number"
                          defaultValue={sc ?? 0}
                          onBlur={(e) => save(columns[ci].id, r.studentId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") save(columns[ci].id, r.studentId, (e.target as HTMLInputElement).value);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="w-12 rounded-md border-2 border-primary px-1 py-1 text-center text-[13px] font-bold outline-none"
                        />
                      ) : (
                        <button
                          disabled={!canEdit}
                          onClick={() => canEdit && setEditing({ studentId: r.studentId, col: ci })}
                          className={`rounded-md px-2 py-1 text-[13.5px] font-semibold ${canEdit ? "hover:bg-primary-soft" : ""}`}
                          style={{ color: sc === null ? "var(--text-3)" : scoreColor(sc), cursor: canEdit ? "pointer" : "default" }}
                        >
                          {sc ?? "—"}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="px-3.5 py-2.5 text-center">
                  <span className="text-[15px] font-extrabold" style={{ color: scoreColor(r.avg) }}>
                    {r.avg}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <Badge tone={r.avg >= PASS_THRESHOLD ? "success" : "danger"}>{r.avg >= PASS_THRESHOLD ? "Tuntas" : "Remedial"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
