/**
 * Meta absensi yang dipakai bersama komponen klien dan pembuat berkas ekspor.
 * Sengaja tanpa impor Prisma supaya aman di bundel klien; tipe status ditulis
 * ulang sebagai union literal yang sama persis dengan enum AttendanceStatus.
 */

export type Status = "PRESENT" | "EXCUSED" | "SICK" | "LATE" | "ABSENT";
export type StatusKey = Status | "UNMARKED";
export type Counts = Record<StatusKey, number>;

export type StatusMeta = { code: string; label: string; color: string; soft: string };

export const STATUS_ORDER: readonly Status[] = ["PRESENT", "EXCUSED", "SICK", "LATE", "ABSENT"];
export const STATUS_KEYS: readonly StatusKey[] = [...STATUS_ORDER, "UNMARKED"];

export const STATUS_META: Record<StatusKey, StatusMeta> = {
  PRESENT: { code: "H", label: "Hadir", color: "var(--green)", soft: "var(--green-soft)" },
  EXCUSED: { code: "I", label: "Izin", color: "var(--primary)", soft: "var(--primary-soft)" },
  SICK: { code: "S", label: "Sakit", color: "var(--teal)", soft: "var(--teal-soft)" },
  LATE: { code: "T", label: "Terlambat", color: "var(--amber)", soft: "var(--amber-soft)" },
  ABSENT: { code: "A", label: "Alpa", color: "var(--red)", soft: "var(--red-soft)" },
  /** Santri tanpa catatan sama sekali: netral, jelas berbeda dari "Hadir". */
  UNMARKED: { code: "–", label: "Belum ditandai", color: "var(--text-3)", soft: "var(--surface-2)" },
};

export function statusMeta(status: Status | null): StatusMeta {
  return STATUS_META[status ?? "UNMARKED"];
}

/** Ambang kehadiran yang dianggap aman; di bawah ini santri masuk daftar pantauan. */
export const ATTENDANCE_ALERT_THRESHOLD = 75;

export function rateColor(pct: number): string {
  if (pct >= 90) return "var(--green)";
  if (pct >= ATTENDANCE_ALERT_THRESHOLD) return "var(--amber)";
  return "var(--red)";
}

export type SessionView = {
  id: string;
  title: string;
  date: string;
  dateFull: string;
  dateKey: string;
  time: string;
  heldAt: string;
  recordCount: number;
  counts: Counts;
};

export type RowView = {
  studentId: string;
  name: string;
  studentNumber: string;
  marks: (Status | null)[];
  notes: (string | null)[];
  counts: Counts;
  rate: number | null;
};

export function markedCount(counts: Counts): number {
  return STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0);
}

export function rateOf(counts: Counts): number | null {
  const marked = markedCount(counts);
  return marked ? Math.round((counts.PRESENT / marked) * 100) : null;
}

/* --------------------------------- ekspor --------------------------------- */

/**
 * Excel berlokal Indonesia memakai titik koma sebagai pemisah kolom; memakai
 * koma membuat seluruh baris menumpuk di satu sel saat berkas dibuka.
 */
const SEP = ";";

function cell(value: string | number | null): string {
  const text = String(value ?? "");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(cells: (string | number | null)[]): string {
  return cells.map(cell).join(SEP);
}

const SUMMARY_HEADERS = ["Hadir", "Izin", "Sakit", "Terlambat", "Alpa", "Belum ditandai"];

function summaryCells(counts: Counts): number[] {
  return STATUS_KEYS.map((key) => counts[key]);
}

export function buildAttendanceCsv(input: {
  courseTitle: string;
  teacherName: string | null;
  rangeLabel: string;
  generatedAt: string;
  sessions: SessionView[];
  rows: RowView[];
}): string {
  const { sessions, rows } = input;
  const out: string[] = [
    line(["Rekap Absensi Santri"]),
    line(["Mata pelajaran", input.courseTitle]),
    line(["Pengampu", input.teacherName ?? "Belum ditugaskan"]),
    line(["Rentang", input.rangeLabel]),
    line(["Jumlah sesi", sessions.length]),
    line(["Diunduh", input.generatedAt]),
    "",
    line(["No", "NIS", "Nama santri", ...sessions.map((s) => `${s.date} — ${s.title}`), ...SUMMARY_HEADERS, "Persen hadir"]),
  ];

  rows.forEach((row, i) => {
    out.push(
      line([
        i + 1,
        row.studentNumber,
        row.name,
        ...row.marks.map((m) => statusMeta(m).code),
        ...summaryCells(row.counts),
        row.rate === null ? "-" : `${row.rate}%`,
      ]),
    );
  });

  out.push("", line(["Rekap per sesi"]), line(["Sesi", "Tanggal", "Jam", ...SUMMARY_HEADERS, "Persen hadir"]));
  for (const session of sessions) {
    const rate = rateOf(session.counts);
    out.push(line([session.title, session.dateFull, session.time, ...summaryCells(session.counts), rate === null ? "-" : `${rate}%`]));
  }

  out.push("", line(["Keterangan kode"]));
  for (const key of STATUS_KEYS) {
    out.push(line([STATUS_META[key].code, STATUS_META[key].label]));
  }

  return out.join("\r\n");
}

/** Nama berkas yang aman dipakai lintas sistem berkas. */
export function csvFileName(courseTitle: string, rangeLabel: string): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `absensi-${slug(courseTitle) || "mapel"}-${slug(rangeLabel) || "semua"}.csv`;
}

export function downloadCsv(fileName: string, content: string) {
  // BOM supaya huruf beraksen tetap benar saat berkas dibuka di Excel.
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
