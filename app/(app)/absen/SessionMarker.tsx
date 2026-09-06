"use client";

import { useState } from "react";
import { Avatar, Button, Card, Icons, Progress, inputClasses } from "@/components/ui";
import {
  STATUS_META,
  STATUS_ORDER,
  markedCount,
  rateColor,
  rateOf,
  statusMeta,
  type RowView,
  type SessionView,
  type Status,
  type StatusKey,
} from "./attendance-ui";

type Filter = "ALL" | StatusKey;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "UNMARKED", label: "Belum ditandai" },
  ...STATUS_ORDER.map((s) => ({ key: s as Filter, label: STATUS_META[s].label })),
];

/**
 * Mode ambil absen: satu sesi, satu daftar santri, satu ketukan per status —
 * alur yang sama seperti buku absensi harian, berbeda dari matriks rekap.
 */
export function SessionMarker({
  sessions,
  rows,
  index,
  onSelectIndex,
  canEdit,
  pending,
  onMark,
  onBulk,
  query,
}: {
  sessions: SessionView[];
  rows: RowView[];
  index: number;
  onSelectIndex: (index: number) => void;
  canEdit: boolean;
  pending: boolean;
  onMark: (sessionIndex: number, studentId: string, status: Status | null, note?: string | null) => void;
  onBulk: (status: Status, scope: "all" | "unmarked") => void;
  query: string;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const session = sessions[index];
  const counts = session.counts;
  const marked = markedCount(counts);
  const rate = rateOf(counts);
  const total = rows.length;

  const visible = rows.filter((r) => {
    if (filter !== "ALL" && (r.marks[index] ?? "UNMARKED") !== filter) return false;
    if (!query) return true;
    const needle = query.toLowerCase();
    return r.name.toLowerCase().includes(needle) || r.studentNumber.toLowerCase().includes(needle);
  });

  function openNote(row: RowView) {
    setNoteFor(row.studentId);
    setNoteDraft(row.notes[index] ?? "");
  }

  function saveNote(row: RowView) {
    const status = row.marks[index];
    setNoteFor(null);
    if (!status) return;
    if ((row.notes[index] ?? "") === noteDraft.trim()) return;
    onMark(index, row.studentId, status, noteDraft.trim());
  }

  return (
    <>
      <Card pad={16} className="mb-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onSelectIndex(index - 1)}
            disabled={index === 0}
            aria-label="Sesi sebelumnya"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition hover:bg-surface-2 disabled:opacity-40"
          >
            <Icons.chevL size={16} />
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Pilih sesi absensi</span>
            <select
              value={session.id}
              onChange={(e) => onSelectIndex(sessions.findIndex((s) => s.id === e.target.value))}
              className={inputClasses}
            >
              {sessions.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {s.date} • {s.title}
                  {i === sessions.length - 1 ? " (terbaru)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => onSelectIndex(index + 1)}
            disabled={index === sessions.length - 1}
            aria-label="Sesi berikutnya"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition hover:bg-surface-2 disabled:opacity-40"
          >
            <Icons.chevR size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12.5px] text-ink-3">
            {session.dateFull} • {session.time}
          </div>
          <div className="text-[12.5px] font-semibold text-ink-2">
            {marked}/{total} santri ditandai
            {rate === null ? null : <span style={{ color: rateColor(rate) }}> • {rate}% hadir</span>}
          </div>
        </div>
        <div className="mt-2">
          <Progress value={total ? (marked / total) * 100 : 0} color={marked === total ? "var(--green)" : "var(--primary)"} h={6} />
        </div>

        {canEdit ? (
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-line pt-3.5">
            <Button variant="soft" size="sm" disabled={pending} icon={<Icons.check2 size={14} />} onClick={() => onBulk("PRESENT", "all")}>
              Semua hadir
            </Button>
            <Button variant="ghost" size="sm" disabled={pending || marked === total} onClick={() => onBulk("PRESENT", "unmarked")}>
              Sisanya hadir
            </Button>
            <Button variant="ghost" size="sm" disabled={pending || marked === total} onClick={() => onBulk("ABSENT", "unmarked")}>
              Sisanya alpa
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const n = f.key === "ALL" ? total : counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                active ? "border-transparent bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              {f.label} <span className={active ? "opacity-70" : "text-ink-3"}>{n}</span>
            </button>
          );
        })}
      </div>

      <Card pad={0} className="overflow-hidden">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-3">Tidak ada santri yang cocok dengan filter ini.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((row) => {
              const status = row.marks[index];
              const meta = statusMeta(status);
              const note = row.notes[index];
              return (
                <li key={row.studentId} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar
                      initials={row.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      color={status ? meta.color : "var(--text-3)"}
                      size={34}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{row.name}</div>
                      <div className="text-[12px] text-ink-3">
                        {row.studentNumber}
                        {note ? <span className="text-ink-2"> • {note}</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {STATUS_ORDER.map((s) => {
                        const active = status === s;
                        const sm = STATUS_META[s];
                        return (
                          <button
                            key={s}
                            onClick={() => onMark(index, row.studentId, s, note)}
                            disabled={!canEdit}
                            title={sm.label}
                            aria-label={`${sm.label} — ${row.name}`}
                            aria-pressed={active}
                            className="grid h-9 w-9 place-items-center rounded-xl text-[13px] font-bold transition active:scale-90 disabled:cursor-default"
                            style={{
                              background: active ? sm.color : sm.soft,
                              color: active ? "#fff" : sm.color,
                              opacity: canEdit || active ? 1 : 0.55,
                            }}
                          >
                            {sm.code}
                          </button>
                        );
                      })}
                      {canEdit ? (
                        <>
                          <button
                            onClick={() => (noteFor === row.studentId ? setNoteFor(null) : openNote(row))}
                            disabled={!status}
                            title={status ? "Keterangan" : "Tandai status dulu sebelum menulis keterangan"}
                            aria-label={`Keterangan untuk ${row.name}`}
                            className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-surface-2 disabled:opacity-30"
                          >
                            <Icons.edit size={14} />
                          </button>
                          <button
                            onClick={() => onMark(index, row.studentId, null)}
                            disabled={!status}
                            title="Kosongkan tanda"
                            aria-label={`Kosongkan tanda ${row.name}`}
                            className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                          >
                            <Icons.x size={14} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {noteFor === row.studentId ? (
                    <div className="mt-2.5 flex gap-2">
                      <input
                        autoFocus
                        value={noteDraft}
                        maxLength={160}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveNote(row);
                          if (e.key === "Escape") setNoteFor(null);
                        }}
                        placeholder="cth. izin acara keluarga"
                        aria-label={`Keterangan absensi ${row.name}`}
                        className={inputClasses}
                      />
                      <Button variant="primary" size="sm" disabled={pending} onClick={() => saveNote(row)}>
                        Simpan
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
