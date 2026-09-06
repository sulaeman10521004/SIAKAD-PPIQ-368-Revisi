// Uji bagian murni layar absensi (rekap & pembuat berkas ekspor), tanpa React
// maupun basis data. Dijalankan bersama uji lain lewat `pnpm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAttendanceCsv,
  csvFileName,
  markedCount,
  rateColor,
  rateOf,
  statusMeta,
  type Counts,
  type RowView,
  type SessionView,
} from "./attendance-ui";

function counts(partial: Partial<Counts>): Counts {
  return { PRESENT: 0, EXCUSED: 0, SICK: 0, LATE: 0, ABSENT: 0, UNMARKED: 0, ...partial };
}

const SESSIONS: SessionView[] = [
  {
    id: "s1",
    title: "Pertemuan 1",
    date: "01 Sep",
    dateFull: "Senin, 1 September 2025",
    dateKey: "2025-09-01",
    time: "07.30",
    heldAt: "2025-09-01T07:30",
    recordCount: 2,
    counts: counts({ PRESENT: 1, ABSENT: 1 }),
  },
  {
    id: "s2",
    title: "Pertemuan 2; ulangan",
    date: "08 Sep",
    dateFull: "Senin, 8 September 2025",
    dateKey: "2025-09-08",
    time: "07.30",
    heldAt: "2025-09-08T07:30",
    recordCount: 1,
    counts: counts({ PRESENT: 1, UNMARKED: 1 }),
  },
];

const ROWS: RowView[] = [
  {
    studentId: "a",
    name: "Ahmad",
    studentNumber: "2401",
    marks: ["PRESENT", "PRESENT"],
    notes: [null, null],
    counts: counts({ PRESENT: 2 }),
    rate: 100,
  },
  {
    studentId: "b",
    name: "Bilal",
    studentNumber: "2402",
    marks: ["ABSENT", null],
    notes: ["tanpa kabar", null],
    counts: counts({ ABSENT: 1, UNMARKED: 1 }),
    rate: 0,
  },
];

describe("rekap absensi", () => {
  it("hanya menghitung sesi yang sudah ditandai", () => {
    assert.equal(markedCount(counts({ PRESENT: 3, ABSENT: 1, UNMARKED: 5 })), 4);
    assert.equal(rateOf(counts({ PRESENT: 3, ABSENT: 1, UNMARKED: 5 })), 75);
  });

  it("mengembalikan null bila belum ada satu tanda pun", () => {
    assert.equal(rateOf(counts({ UNMARKED: 4 })), null);
  });

  it("memakai warna peringatan di bawah ambang", () => {
    assert.equal(rateColor(95), "var(--green)");
    assert.equal(rateColor(80), "var(--amber)");
    assert.equal(rateColor(74), "var(--red)");
  });

  it("membedakan belum ditandai dari hadir", () => {
    assert.equal(statusMeta(null).code, "–");
    assert.equal(statusMeta("PRESENT").code, "H");
  });
});

describe("buildAttendanceCsv", () => {
  const csv = buildAttendanceCsv({
    courseTitle: "Nahwu Dasar",
    teacherName: "Ust. Fulan",
    rangeLabel: "1 Sep 2025 – 30 Sep 2025",
    generatedAt: "1 Oktober 2025 08.00",
    sessions: SESSIONS,
    rows: ROWS,
  });
  const lines = csv.split("\r\n");

  it("memuat kepala berkas beserta konteks rekapnya", () => {
    assert.equal(lines[0], "Rekap Absensi Santri");
    assert.ok(lines.includes("Mata pelajaran;Nahwu Dasar"));
    assert.ok(lines.includes("Rentang;1 Sep 2025 – 30 Sep 2025"));
    assert.ok(lines.includes("Jumlah sesi;2"));
  });

  it("menulis satu baris per santri lengkap dengan rekap dan persentase", () => {
    assert.ok(lines.includes("1;2401;Ahmad;H;H;2;0;0;0;0;0;100%"));
    assert.ok(lines.includes("2;2402;Bilal;A;–;0;0;0;0;1;1;0%"));
  });

  it("mengutip judul yang mengandung pemisah kolom", () => {
    const header = lines.find((l) => l.startsWith("No;")) ?? "";
    assert.ok(header.includes('"08 Sep — Pertemuan 2; ulangan"'));
  });

  it("menyertakan rekap per sesi dan keterangan kode", () => {
    assert.ok(lines.includes("Rekap per sesi"));
    assert.ok(lines.some((l) => l.startsWith("Pertemuan 1;Senin, 1 September 2025;07.30;1;0;0;0;1;0;50%")));
    assert.ok(lines.includes("H;Hadir"));
    assert.ok(lines.includes("–;Belum ditandai"));
  });

  it("membuat nama berkas yang aman", () => {
    assert.equal(csvFileName("Nahwu Dasar", "Semua sesi"), "absensi-nahwu-dasar-semua-sesi.csv");
  });
});
