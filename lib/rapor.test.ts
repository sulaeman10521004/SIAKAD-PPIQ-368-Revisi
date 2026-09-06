// Uji bagian murni mesin rapor (tanpa database). Dijalankan dengan test runner
// bawaan Node lewat tsx agar alias "@/..." ikut terbaca: `pnpm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AttendanceStatus } from "@/generated/prisma/client";
import {
  buildEntries,
  computeWeightedScore,
  emptyMarks,
  groupEntries,
  isUngraded,
  moreSevereStatus,
  recapFromDailyStatuses,
  recapFromMarks,
  resolveSubjectMax,
  terbilang,
  toScaleValue,
  UNGRADED_WORDS,
  UNGROUPED_NAME,
  UNGROUPED_SORT_ORDER,
} from "@/lib/rapor";

describe("computeWeightedScore", () => {
  it("mengembalikan null bila tidak ada komponen bernilai", () => {
    assert.equal(computeWeightedScore([]), null);
  });

  it("menghitung rata-rata berbobot", () => {
    // UTS 80/100 bobot 40 + UAS 90/100 bobot 60 = 32 + 54 = 86.
    const score = computeWeightedScore([
      { score: 80, maxScore: 100, weight: 40 },
      { score: 90, maxScore: 100, weight: 60 },
    ]);
    assert.equal(score, 86);
  });

  it("menormalkan bobot yang jumlahnya bukan 100", () => {
    // Bobot 1:3 => 80*0.25 + 100*0.75 = 95, sama seperti bobot 25:75.
    const score = computeWeightedScore([
      { score: 8, maxScore: 10, weight: 1 },
      { score: 10, maxScore: 10, weight: 3 },
    ]);
    assert.equal(score, 95);
    assert.equal(
      score,
      computeWeightedScore([
        { score: 8, maxScore: 10, weight: 25 },
        { score: 10, maxScore: 10, weight: 75 },
      ]),
    );
  });

  it("memakai rata-rata biasa bila semua bobot nol (tidak NaN)", () => {
    const score = computeWeightedScore([
      { score: 10, maxScore: 10, weight: 0 },
      { score: 6, maxScore: 10, weight: 0 },
    ]);
    assert.equal(score, 80);
    assert.ok(Number.isFinite(score as number));
  });

  it("mengabaikan bobot negatif seperti bobot nol", () => {
    const score = computeWeightedScore([
      { score: 10, maxScore: 10, weight: -5 },
      { score: 6, maxScore: 10, weight: -5 },
    ]);
    assert.equal(score, 80);
  });

  it("menyaring komponen dengan maxScore 0", () => {
    const score = computeWeightedScore([
      { score: 0, maxScore: 0, weight: 50 },
      { score: 7, maxScore: 10, weight: 50 },
    ]);
    assert.equal(score, 70);
  });

  it("mengembalikan null bila semua komponen ber-maxScore 0", () => {
    assert.equal(computeWeightedScore([{ score: 5, maxScore: 0, weight: 100 }]), null);
  });

  it("membedakan nilai nol sungguhan dari belum dinilai", () => {
    assert.equal(computeWeightedScore([{ score: 0, maxScore: 10, weight: 100 }]), 0);
  });
});

describe("toScaleValue", () => {
  it("memetakan 0-100 ke skala mapel", () => {
    assert.equal(toScaleValue(100, 7), 7);
    assert.equal(toScaleValue(0, 7), 0);
    assert.equal(toScaleValue(86, 10), 9);
    assert.equal(toScaleValue(50, 7), 4); // 3,5 dibulatkan ke atas
  });

  it("menjepit hasil di rentang 0..maxScore", () => {
    assert.equal(toScaleValue(120, 10), 10);
    assert.equal(toScaleValue(-20, 10), 0);
  });

  it("mengembalikan 0 bila skala mapel tidak valid", () => {
    assert.equal(toScaleValue(90, 0), 0);
    assert.equal(toScaleValue(90, -3), 0);
  });
});

describe("terbilang", () => {
  it("mencakup 0-10 sesuai formulir rapor", () => {
    const expected = [
      "Nol",
      "Satu",
      "Dua",
      "Tiga",
      "Empat",
      "Lima",
      "Enam",
      "Tujuh",
      "Delapan",
      "Sembilan",
      "Sepuluh",
    ];
    expected.forEach((word, value) => assert.equal(terbilang(value), word));
  });

  it("tetap wajar di atas sepuluh", () => {
    assert.equal(terbilang(11), "Sebelas");
    assert.equal(terbilang(15), "Lima Belas");
    assert.equal(terbilang(21), "Dua Puluh Satu");
    assert.equal(terbilang(100), "Seratus");
    assert.equal(terbilang(1000), "Seribu");
    assert.equal(terbilang(2025), "Dua Ribu Dua Puluh Lima");
  });

  it("aman untuk angka negatif, pecahan, dan bukan angka", () => {
    assert.equal(terbilang(-3), "Minus Tiga");
    assert.equal(terbilang(7.8), "Tujuh");
    assert.equal(terbilang(Number.NaN), "-");
    assert.equal(terbilang(Number.POSITIVE_INFINITY), "-");
  });
});

describe("resolveSubjectMax", () => {
  it("mendahulukan nilai maksimal milik mapel", () => {
    assert.equal(resolveSubjectMax(6, 7), 6);
  });

  it("jatuh ke bawaan kelompok lalu ke cadangan 10", () => {
    assert.equal(resolveSubjectMax(null, 7), 7);
    assert.equal(resolveSubjectMax(null, null), 10);
  });

  it("menghormati nol sebagai nilai yang disetel, bukan kosong", () => {
    assert.equal(resolveSubjectMax(0, 7), 0);
    assert.equal(resolveSubjectMax(null, 0), 0);
  });
});

describe("recapFromMarks", () => {
  it("memetakan status ke kolom formulir (lain-lain = alpa + terlambat)", () => {
    const recap = recapFromMarks({ PRESENT: 9, ABSENT: 2, LATE: 3, EXCUSED: 4, SICK: 5 });
    assert.deepEqual(recap, { sickCount: 5, excusedCount: 4, otherCount: 5 });
  });

  it("hadir tidak masuk rekap ketidakhadiran", () => {
    assert.deepEqual(recapFromMarks({ ...emptyMarks(), PRESENT: 12 }), {
      sickCount: 0,
      excusedCount: 0,
      otherCount: 0,
    });
  });
});

describe("moreSevereStatus", () => {
  it("mengambil status baru bila hari itu belum tercatat", () => {
    assert.equal(moreSevereStatus(undefined, "PRESENT"), "PRESENT");
  });

  it("memenangkan status yang lebih berat, dari arah mana pun", () => {
    assert.equal(moreSevereStatus("SICK", "ABSENT"), "ABSENT");
    assert.equal(moreSevereStatus("PRESENT", "LATE"), "LATE");
    assert.equal(moreSevereStatus("EXCUSED", "PRESENT"), "EXCUSED");
    assert.equal(moreSevereStatus("ABSENT", "SICK"), "ABSENT");
  });

  it("mempertahankan status lama bila sama beratnya", () => {
    assert.equal(moreSevereStatus("SICK", "SICK"), "SICK");
  });
});

describe("recapFromDailyStatuses", () => {
  it("menghitung per hari, bukan per sesi mapel", () => {
    // Satu hari sakit walau santri punya banyak mapel: petanya hanya berisi satu
    // entri per tanggal karena pemanggil sudah meringkasnya lewat moreSevereStatus.
    const statuses = new Map<string, AttendanceStatus>([
      ["2026-01-05", "SICK"],
      ["2026-01-06", "SICK"],
      ["2026-01-07", "EXCUSED"],
      ["2026-01-08", "ABSENT"],
      ["2026-01-09", "LATE"],
      ["2026-01-10", "PRESENT"],
    ]);
    assert.deepEqual(recapFromDailyStatuses(statuses), {
      sickCount: 2,
      excusedCount: 1,
      otherCount: 2,
    });
  });

  it("peta kosong berarti rekap nol", () => {
    assert.deepEqual(recapFromDailyStatuses(new Map()), {
      sickCount: 0,
      excusedCount: 0,
      otherCount: 0,
    });
  });
});

describe("buildEntries", () => {
  const course = (over: Partial<Parameters<typeof buildEntries>[0][number]> = {}) => ({
    courseId: "c1",
    courseTitle: "Tafsir",
    reportMaxScore: 7,
    groupName: "Nilai Ujian Tulis",
    groupSortOrder: 1,
    groupDefaultMaxScore: 7,
    components: [{ score: 80, maxScore: 100, weight: 100 }],
    marks: emptyMarks(),
    ...over,
  });

  it("menghitung nilai akhir, skala rapor, dan terbilangnya", () => {
    const [entry] = buildEntries([course()]);
    assert.equal(entry.finalScore, 80);
    assert.equal(entry.maxScore, 7);
    assert.equal(entry.scoreValue, 6); // 80% dari 7 = 5,6 -> 6
    assert.equal(entry.scoreWords, "Enam");
    assert.equal(isUngraded(entry), false);
  });

  it("menandai mapel tanpa komponen bernilai sebagai belum dinilai", () => {
    const [entry] = buildEntries([course({ components: [] })]);
    assert.equal(entry.finalScore, 0);
    assert.equal(entry.scoreValue, 0);
    assert.equal(entry.scoreWords, UNGRADED_WORDS);
    assert.equal(isUngraded(entry), true);
  });

  it("memakai kelompok cadangan bila mapel belum punya kelompok", () => {
    const [entry] = buildEntries([
      course({ groupName: null, groupSortOrder: null, groupDefaultMaxScore: null, reportMaxScore: null }),
    ]);
    assert.equal(entry.groupName, UNGROUPED_NAME);
    assert.equal(entry.groupSortOrder, UNGROUPED_SORT_ORDER);
    assert.equal(entry.maxScore, 10);
  });

  it("membuang judul mapel kembar karena entri rapor unik per judul", () => {
    const entries = buildEntries([
      course({ courseId: "c1", courseTitle: "Tafsir" }),
      course({ courseId: "c2", courseTitle: "Tafsir", components: [{ score: 10, maxScore: 100, weight: 100 }] }),
    ]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].courseId, "c1");
  });

  it("mengurutkan per kelompok lalu judul mapel", () => {
    const entries = buildEntries([
      course({ courseId: "c1", courseTitle: "Renang", groupName: "Ekstrakurikuler", groupSortOrder: 2 }),
      course({ courseId: "c2", courseTitle: "Tafsir", groupSortOrder: 1 }),
      course({ courseId: "c3", courseTitle: "Hadis", groupSortOrder: 1 }),
    ]);
    assert.deepEqual(
      entries.map((entry) => entry.courseTitle),
      ["Hadis", "Tafsir", "Renang"],
    );
  });

  it("menyalin rekap kehadiran per mapel apa adanya", () => {
    const [entry] = buildEntries([
      course({ marks: { PRESENT: 5, ABSENT: 1, LATE: 2, EXCUSED: 3, SICK: 4 } }),
    ]);
    assert.deepEqual(
      { present: entry.present, late: entry.late, absent: entry.absent, excused: entry.excused },
      { present: 5, late: 2, absent: 1, excused: 3 },
    );
  });
});

describe("groupEntries", () => {
  const entry = (courseTitle: string, groupName: string, groupSortOrder: number) => ({
    courseTitle,
    groupName,
    groupSortOrder,
  });

  it("mengelompokkan baris dan mengurutkannya sesuai urutan formulir", () => {
    const groups = groupEntries([
      entry("Renang", "Ekstrakurikuler", 2),
      entry("Tafsir", "Ujian Tulis", 1),
      entry("Hadis", "Ujian Tulis", 1),
    ]);
    assert.deepEqual(
      groups.map((group) => group.name),
      ["Ujian Tulis", "Ekstrakurikuler"],
    );
    assert.deepEqual(
      groups[0].entries.map((row) => row.courseTitle),
      ["Tafsir", "Hadis"], // urutan di dalam kelompok mengikuti masukan
    );
    assert.equal(groups[1].entries.length, 1);
  });

  it("mengembalikan daftar kosong untuk masukan kosong", () => {
    assert.deepEqual(groupEntries([]), []);
  });
});

describe("isUngraded", () => {
  it("menandai mapel yang belum dinilai", () => {
    assert.equal(isUngraded({ scoreWords: UNGRADED_WORDS }), true);
  });

  it("nilai nol sungguhan bukan berarti belum dinilai", () => {
    assert.equal(isUngraded({ scoreWords: terbilang(0) }), false);
    assert.equal(isUngraded({ scoreWords: "Nol" }), false);
    assert.equal(isUngraded({ scoreWords: "" }), false);
  });
});
