"use client";

import { Avatar, Card } from "@/components/ui";
import {
  ATTENDANCE_ALERT_THRESHOLD,
  STATUS_KEYS,
  STATUS_META,
  STATUS_ORDER,
  markedCount,
  rateColor,
  statusMeta,
  type RowView,
  type SessionView,
  type Status,
} from "./attendance-ui";

/** Ketukan pada sel memutar status, lalu kembali ke "belum ditandai" untuk membatalkan. */
function nextStatus(current: Status | null): Status | null {
  if (current === null) return STATUS_ORDER[0];
  const i = STATUS_ORDER.indexOf(current);
  return i === STATUS_ORDER.length - 1 ? null : STATUS_ORDER[i + 1];
}

export function AttendanceGrid({
  sessions,
  rows,
  canEdit,
  onMark,
}: {
  sessions: SessionView[];
  rows: RowView[];
  canEdit: boolean;
  onMark: (sessionIndex: number, studentId: string, status: Status | null, note?: string | null) => void;
}) {
  const latest = sessions.length - 1;

  return (
    <Card pad={0} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-[2] min-w-[210px] bg-surface-2 px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-2">
                Santri
              </th>
              {sessions.map((s, i) => {
                const marked = markedCount(s.counts);
                return (
                  <th
                    key={s.id}
                    title={`${s.title} — ${s.dateFull}`}
                    className="whitespace-nowrap px-3 py-3 text-center text-xs font-bold uppercase tracking-wide"
                    style={{ color: i === latest ? "var(--primary-700)" : "var(--text-2)" }}
                  >
                    {s.date}
                    <div className="text-[9px] font-bold" style={{ color: marked === rows.length ? "var(--green)" : "var(--text-3)" }}>
                      {marked}/{rows.length}
                    </div>
                  </th>
                );
              })}
              {STATUS_ORDER.map((s) => (
                <th
                  key={s}
                  title={STATUS_META[s].label}
                  className="border-l border-line px-2 py-3 text-center text-xs font-bold uppercase tracking-wide"
                  style={{ color: STATUS_META[s].color }}
                >
                  {STATUS_META[s].code}
                </th>
              ))}
              <th className="px-3.5 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const alert = r.rate !== null && r.rate < ATTENDANCE_ALERT_THRESHOLD;
              return (
                <tr key={r.studentId} className="border-t border-line">
                  <td className="sticky left-0 z-[1] bg-surface px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-right text-[12px] font-semibold text-ink-3">{ri + 1}</span>
                      <Avatar
                        initials={r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        color={alert ? "var(--red)" : "var(--primary)"}
                        size={30}
                      />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap text-[13.5px] font-semibold">{r.name}</div>
                        <div className="text-[11.5px] text-ink-3">{r.studentNumber}</div>
                      </div>
                    </div>
                  </td>
                  {r.marks.map((m, ci) => {
                    const meta = statusMeta(m);
                    const note = r.notes[ci];
                    return (
                      <td key={sessions[ci].id} className="px-1.5 py-2 text-center">
                        <button
                          onClick={() => onMark(ci, r.studentId, nextStatus(m), note)}
                          disabled={!canEdit}
                          title={`${sessions[ci].title} — ${meta.label}${note ? ` (${note})` : ""}`}
                          className="grid h-[30px] w-[30px] place-items-center rounded-lg text-[12.5px] font-bold transition active:scale-90"
                          style={{
                            background: meta.soft,
                            color: meta.color,
                            border: ci === latest ? `1.5px solid ${meta.color}` : "1.5px solid transparent",
                            cursor: canEdit ? "pointer" : "default",
                          }}
                        >
                          {meta.code}
                        </button>
                      </td>
                    );
                  })}
                  {STATUS_ORDER.map((s) => (
                    <td
                      key={s}
                      className="border-l border-line px-2 py-2.5 text-center text-[13px] font-semibold"
                      style={{ color: r.counts[s] ? STATUS_META[s].color : "var(--text-3)" }}
                    >
                      {r.counts[s]}
                    </td>
                  ))}
                  <td className="px-3.5 py-2.5 text-center">
                    {r.rate === null ? (
                      <span className="text-[13.5px] font-bold text-ink-3">–</span>
                    ) : (
                      <span className="text-[13.5px] font-bold" style={{ color: rateColor(r.rate) }}>
                        {r.rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-line bg-surface-2 px-4 py-3">
        {STATUS_KEYS.map((key) => {
          const meta = STATUS_META[key];
          return (
            <div key={key} className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span
                className="grid h-[22px] w-[22px] place-items-center rounded-md text-[11px] font-bold"
                style={{ background: meta.soft, color: meta.color, border: key === "UNMARKED" ? "1px solid var(--border)" : "none" }}
              >
                {meta.code}
              </span>
              {meta.label}
            </div>
          );
        })}
        <span className="text-[12px] text-ink-3">
          % dihitung dari sesi yang sudah ditandai saja{canEdit ? "; ketuk sel untuk memutar status." : "."}
        </span>
      </div>
    </Card>
  );
}
