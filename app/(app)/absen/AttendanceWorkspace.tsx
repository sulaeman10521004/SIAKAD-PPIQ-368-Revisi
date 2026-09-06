"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icons, Ring, inputClasses } from "@/components/ui";
import { Toast } from "../_components/crud-ui";
import { downloadExcelReport, printTableReport, type ExportColumn, type ExportRow } from "@/lib/export-client";
import { bulkMarkAttendanceAction, clearAttendanceStatusAction, setAttendanceStatusAction } from "../actions";
import { AttendanceGrid } from "./AttendanceGrid";
import { SessionMarker } from "./SessionMarker";
import {
  ATTENDANCE_ALERT_THRESHOLD,
  STATUS_KEYS,
  STATUS_META,
  markedCount,
  statusMeta,
  type Counts,
  type RowView,
  type SessionView,
  type Status,
} from "./attendance-ui";

type View = "sesi" | "rekap";
type RecapFilter = "ALL" | "LOW" | "ABSENT" | "INCOMPLETE";
type Sort = "name" | "rate";

const RECAP_FILTERS: { key: RecapFilter; label: string }[] = [
  { key: "ALL", label: "Semua santri" },
  { key: "LOW", label: `Kehadiran < ${ATTENDANCE_ALERT_THRESHOLD}%` },
  { key: "ABSENT", label: "Pernah alpa" },
  { key: "INCOMPLETE", label: "Ada sesi belum ditandai" },
];

function emptyCounts(): Counts {
  return { PRESENT: 0, EXCUSED: 0, SICK: 0, LATE: 0, ABSENT: 0, UNMARKED: 0 };
}

const stampFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" });

/**
 * Ruang kerja absensi: rekap, saringan, ambil absen per sesi, matriks, dan
 * ekspor. Rekap dihitung ulang di klien dari baris yang sama dengan yang
 * ditandai, sehingga angkanya ikut berubah seketika tanpa menunggu server.
 */
export function AttendanceWorkspace({
  courseTitle,
  teacherName,
  rangeLabel,
  sessions,
  rows: initialRows,
  canEdit,
}: {
  courseTitle: string;
  teacherName: string | null;
  rangeLabel: string;
  sessions: SessionView[];
  rows: RowView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [syncedRows, setSyncedRows] = useState(initialRows);
  const [view, setView] = useState<View>(canEdit ? "sesi" : "rekap");
  const [query, setQuery] = useState("");
  const [recapFilter, setRecapFilter] = useState<RecapFilter>("ALL");
  const [sort, setSort] = useState<Sort>("name");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "warn" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Server tetap sumber kebenaran: begitu halaman divalidasi ulang, tanda lokal
  // yang sempat optimistis diganti dengan data terbaru.
  if (syncedRows !== initialRows) {
    setSyncedRows(initialRows);
    setRows(initialRows);
  }

  // Sesi aktif disimpan sebagai id, bukan indeks, supaya pilihan tidak melompat
  // saat rentang tanggal berubah; default-nya sesi terbaru.
  const selectedIndex = sessions.findIndex((s) => s.id === selectedSessionId);
  const index = selectedIndex >= 0 ? selectedIndex : Math.max(0, sessions.length - 1);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /** Rekap baris & kolom selalu turunan dari marks, jadi tak ada angka yang bisa basi. */
  const { computedRows, computedSessions, totals } = useMemo(() => {
    const sessionCounts = sessions.map(() => emptyCounts());
    const sum = emptyCounts();
    const computed = rows.map((row) => {
      const counts = emptyCounts();
      row.marks.forEach((mark, i) => {
        const key = mark ?? "UNMARKED";
        counts[key] += 1;
        sum[key] += 1;
        if (sessionCounts[i]) sessionCounts[i][key] += 1;
      });
      const marked = markedCount(counts);
      return { ...row, counts, rate: marked ? Math.round((counts.PRESENT / marked) * 100) : null };
    });
    return {
      computedRows: computed,
      computedSessions: sessions.map((s, i) => ({ ...s, counts: sessionCounts[i] })),
      totals: sum,
    };
  }, [rows, sessions]);

  const needle = query.trim().toLowerCase();
  const searched = useMemo(
    () =>
      needle
        ? computedRows.filter((row) => row.name.toLowerCase().includes(needle) || row.studentNumber.toLowerCase().includes(needle))
        : computedRows,
    [computedRows, needle],
  );

  const recapRows = useMemo(() => {
    const filtered = searched.filter((row) => {
      if (recapFilter === "LOW") return row.rate !== null && row.rate < ATTENDANCE_ALERT_THRESHOLD;
      if (recapFilter === "ABSENT") return row.counts.ABSENT > 0;
      if (recapFilter === "INCOMPLETE") return row.counts.UNMARKED > 0;
      return true;
    });
    if (sort === "rate") {
      return [...filtered].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.name.localeCompare(b.name));
    }
    return filtered;
  }, [searched, recapFilter, sort]);

  const markedTotal = markedCount(totals);
  const overallRate = markedTotal ? Math.round((totals.PRESENT / markedTotal) * 100) : 0;
  const alertCount = computedRows.filter((r) => r.rate !== null && r.rate < ATTENDANCE_ALERT_THRESHOLD).length;

  function mark(sessionIndex: number, studentId: string, status: Status | null, note?: string | null) {
    if (!canEdit) return;
    const session = sessions[sessionIndex];
    if (!session) return;
    const keptNote = status === null ? null : note ?? null;
    setRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              marks: row.marks.map((m, i) => (i === sessionIndex ? status : m)),
              notes: row.notes.map((n, i) => (i === sessionIndex ? keptNote : n)),
            }
          : row,
      ),
    );
    startTransition(async () => {
      const res =
        status === null
          ? await clearAttendanceStatusAction({ sessionId: session.id, studentId })
          : await setAttendanceStatusAction({ sessionId: session.id, studentId, status, note: keptNote });
      if (!res.ok) {
        setToast({ msg: res.message ?? "Gagal menyimpan absensi.", tone: "warn" });
        router.refresh();
      }
    });
  }

  function bulk(status: Status, scope: "all" | "unmarked") {
    const session = sessions[index];
    if (!canEdit || !session) return;
    if (scope === "all" && markedCount(computedSessions[index].counts) > 0) {
      const label = STATUS_META[status].label.toLowerCase();
      if (!confirm(`Tandai semua santri ${label} pada sesi "${session.title}"? Tanda yang sudah ada akan ditimpa.`)) return;
    }
    startTransition(async () => {
      const res = await bulkMarkAttendanceAction({ sessionId: session.id, status, scope });
      setToast(
        res.ok
          ? { msg: `Sesi "${session.title}" diperbarui.`, tone: "ok" }
          : { msg: res.message ?? "Gagal menandai kehadiran.", tone: "warn" },
      );
      router.refresh();
    });
  }

  function exportData(format: "excel" | "pdf") {
    const exported = view === "rekap" ? recapRows : searched;
    if (exported.length === 0) {
      setToast({ msg: "Tidak ada baris untuk diekspor.", tone: "warn" });
      return;
    }
    const sessionColumns: ExportColumn[] = computedSessions.map((session, index) => ({
      key: `session${index}`,
      label: `${session.date} · ${session.title}`,
    }));
    const columns: ExportColumn[] = [
      { key: "no", label: "No" },
      { key: "nis", label: "NIS" },
      { key: "name", label: "Nama Santri" },
      ...sessionColumns,
      ...STATUS_KEYS.map((key) => ({ key: `count${key}`, label: STATUS_META[key].label })),
      { key: "rate", label: "Persen Hadir" },
    ];
    const exportRows: ExportRow[] = exported.map((row, rowIndex) => {
      const result: ExportRow = { no: rowIndex + 1, nis: row.studentNumber, name: row.name, rate: row.rate === null ? "-" : `${row.rate}%` };
      row.marks.forEach((mark, index) => { result[`session${index}`] = statusMeta(mark).label; });
      STATUS_KEYS.forEach((key) => { result[`count${key}`] = row.counts[key]; });
      return result;
    });
    const input = {
      title: "Rekap Absensi Santri",
      meta: {
        "Mata pelajaran": courseTitle,
        Pengampu: teacherName ?? "Belum ditugaskan",
        Rentang: rangeLabel,
        "Jumlah sesi": computedSessions.length,
        Dibuat: stampFmt.format(new Date()),
      },
      columns,
      rows: exportRows,
    };
    if (format === "excel") {
      downloadExcelReport({ ...input, fileName: `absensi-${courseTitle}-${rangeLabel}` });
      setToast({ msg: `${exported.length} santri diekspor ke Excel.`, tone: "ok" });
    } else {
      printTableReport({ ...input, orientation: "landscape" });
    }
  }

  return (
    <>
      {/* rekap rentang */}
      <Card pad={18} className="mb-3.5">
        <div className="grid items-center gap-5 md:grid-cols-[230px_1fr]">
          <div className="flex items-center gap-4 md:border-r md:border-line md:pr-5">
            <Ring value={overallRate} size={82} stroke={10} color="var(--green)" label={`${overallRate}%`} sub="HADIR" />
            <div>
              <div className="text-[13px] font-semibold text-ink-3">{rangeLabel}</div>
              <div className="mt-1 text-[20px] font-extrabold tracking-tight">
                {sessions.length} sesi • {rows.length} santri
              </div>
              <div className="mt-0.5 text-[12px] text-ink-3">{totals.UNMARKED} tanda belum diisi</div>
              <div className="mt-0.5 text-[12px] font-semibold" style={{ color: alertCount ? "var(--red)" : "var(--text-3)" }}>
                {alertCount} santri di bawah {ATTENDANCE_ALERT_THRESHOLD}%
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {STATUS_KEYS.map((key) => (
              <div key={key} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: STATUS_META[key].color }} />
                  <span className="truncate text-[12.5px] font-semibold text-ink-2">{STATUS_META[key].label}</span>
                </div>
                <div className="mt-1.5 text-[24px] font-extrabold tracking-tight" style={{ color: STATUS_META[key].color }}>
                  {totals[key]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* pengalih tampilan + pencarian + ekspor */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(["sesi", "rekap"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                view === v ? "bg-primary text-white" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {v === "sesi" ? "Ambil absen" : "Rekap matriks"}
            </button>
          ))}
        </div>

        <label className="relative min-w-[190px] flex-1">
          <span className="sr-only">Cari santri</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
            <Icons.search size={15} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau NIS santri"
            className={`${inputClasses} pl-9`}
          />
        </label>

        <Button variant="ghost" size="md" icon={<Icons.download size={15} />} onClick={() => exportData("excel")}>
          Excel
        </Button>
        <Button variant="ghost" size="md" icon={<Icons.doc size={15} />} onClick={() => exportData("pdf")}>
          Cetak / PDF
        </Button>
      </div>

      {view === "rekap" ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          {RECAP_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setRecapFilter(f.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                recapFilter === f.key ? "border-transparent bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setSort((s) => (s === "name" ? "rate" : "name"))}
            className="ml-auto whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition hover:bg-surface-2"
          >
            Urut: {sort === "name" ? "nama" : "kehadiran terendah"}
          </button>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada sesi absensi pada rentang ini.</p>
        </Card>
      ) : view === "sesi" ? (
        <SessionMarker
          sessions={computedSessions}
          rows={computedRows}
          index={index}
          onSelectIndex={(i) => setSelectedSessionId(sessions[Math.min(Math.max(i, 0), sessions.length - 1)]?.id ?? null)}
          canEdit={canEdit}
          pending={pending}
          onMark={mark}
          onBulk={bulk}
          query={query.trim()}
        />
      ) : recapRows.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Tidak ada santri yang cocok dengan filter ini.</p>
        </Card>
      ) : (
        <AttendanceGrid sessions={computedSessions} rows={recapRows} canEdit={canEdit} onMark={mark} />
      )}

      {view === "rekap" && recapRows.length > 0 && recapRows.length !== rows.length ? (
        <p className="mt-2.5 text-[12.5px] text-ink-3">
          Menampilkan {recapRows.length} dari {rows.length} santri. Ekspor mengikuti saringan yang aktif.
        </p>
      ) : null}

      <Toast toast={toast} />
    </>
  );
}
