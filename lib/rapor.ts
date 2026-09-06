// Mesin perhitungan + query rapor pondok. Bagian murni (rata-rata berbobot,
// pemetaan skala, terbilang) sengaja dipisah dari query Prisma agar bisa diuji
// tanpa database.

import { cache } from "react";
import {
  AssessmentGroupKind,
  AttendanceStatus,
  EnrollmentStatus,
  Prisma,
  ReportCardStatus,
  type Semester,
} from "@/generated/prisma/client";
import { userCan, type AuthUser } from "@/lib/auth";
import { toDateKey, type Period } from "@/lib/lms";
import { prisma } from "@/lib/prisma";

/* -------------------------------------------------------------------------- */
/*                          konstanta format rapor                            */
/* -------------------------------------------------------------------------- */

/**
 * Penanda tangan pada lembar rapor. Nama maupun jabatannya ikut berganti setiap
 * pergantian pengurus pondok, jadi nilainya disimpan sebagai AppSetting dan
 * disunting administrasi lewat /akademik — bukan dikeraskan di kode.
 */
export const REPORT_SIGNATORY_KEYS = {
  mudirTitle: "report.signatory.mudir.title",
  mudirName: "report.signatory.mudir.name",
  examChairTitle: "report.signatory.exam_chair.title",
  examChairName: "report.signatory.exam_chair.name",
} as const;

export type ReportSignatories = Record<keyof typeof REPORT_SIGNATORY_KEYS, string>;

/** Dipakai selama pengaturan belum diisi; jabatan mengikuti formulir rapor pondok. */
export const DEFAULT_REPORT_SIGNATORIES: ReportSignatories = {
  mudirTitle: "Mudir Ma'had",
  mudirName: "(belum diatur)",
  examChairTitle: "Ketua Panitia Ujian",
  examChairName: "(belum diatur)",
};

/** Penanda tangan rapor terkini; kunci yang kosong jatuh ke nilai bawaan di atas. */
export const getReportSignatories = cache(async (): Promise<ReportSignatories> => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(REPORT_SIGNATORY_KEYS) } },
    select: { key: true, value: true },
  });
  const valueByKey = new Map(rows.map((row) => [row.key, row.value.trim()]));

  const pick = (field: keyof ReportSignatories) =>
    valueByKey.get(REPORT_SIGNATORY_KEYS[field]) || DEFAULT_REPORT_SIGNATORIES[field];

  return {
    mudirTitle: pick("mudirTitle"),
    mudirName: pick("mudirName"),
    examChairTitle: pick("examChairTitle"),
    examChairName: pick("examChairName"),
  };
});

/** Catatan header lembar rapor sesuai formulir pondok. */
export const REPORT_HEADER_NOTE = "Nilai maksimal seluruh mata pelajaran: 10 (sepuluh)";

/** Nilai maksimal cadangan bila mapel maupun kelompoknya tidak menentukan. */
export const DEFAULT_REPORT_MAX_SCORE = 10;

/** Kelompok penampung mapel yang belum punya kelompok penilaian. */
export const UNGROUPED_NAME = "Lainnya";
export const UNGROUPED_SORT_ORDER = 999;

/** Ditulis pada kolom "Nilai dengan Huruf" bila mapel sama sekali belum dinilai. */
export const UNGRADED_WORDS = "Belum Dinilai";

// Label & warna status alur kerja ada di app/(app)/rapor/status.ts agar bisa
// dipakai komponen klien tanpa menarik Prisma ke bundel browser.

/* -------------------------------------------------------------------------- */
/*                           bagian murni (testable)                          */
/* -------------------------------------------------------------------------- */

/** Satu komponen nilai (mis. UTS bobot 40) yang sudah punya nilai santri. */
export type ScoreComponent = { score: number; maxScore: number; weight: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rata-rata berbobot 0-100. Komponen tanpa nilai HARUS sudah disaring pemanggil
 * sehingga bobotnya tidak ikut menjadi pembagi — mapel yang baru dinilai
 * sebagian tidak tertarik ke nol. Mengembalikan null bila tidak ada komponen
 * bernilai sama sekali (artinya "belum dinilai", bukan nol sungguhan).
 */
export function computeWeightedScore(components: readonly ScoreComponent[]): number | null {
  const usable = components.filter((component) => component.maxScore > 0);
  if (usable.length === 0) return null;

  const totalWeight = usable.reduce((sum, component) => sum + Math.max(0, component.weight), 0);
  // Semua bobot 0/negatif: perlakukan sebagai rata-rata biasa agar tidak dibagi nol.
  const divisor = totalWeight > 0 ? totalWeight : usable.length;
  const weightOf = (component: ScoreComponent) => (totalWeight > 0 ? Math.max(0, component.weight) : 1);

  const total = usable.reduce(
    (sum, component) => sum + (component.score / component.maxScore) * 100 * (weightOf(component) / divisor),
    0,
  );

  return clamp(Math.round(total), 0, 100);
}

/** Nilai maksimal mapel: milik mapel, lalu bawaan kelompok, lalu cadangan 10. */
export function resolveSubjectMax(reportMaxScore: number | null, groupDefaultMaxScore: number | null): number {
  return reportMaxScore ?? groupDefaultMaxScore ?? DEFAULT_REPORT_MAX_SCORE;
}

/** Peta nilai 0-100 ke skala rapor mapel (mis. 0-7). */
export function toScaleValue(finalScore100: number, subjectMax: number): number {
  if (subjectMax <= 0) return 0;
  return clamp(Math.round((finalScore100 / 100) * subjectMax), 0, subjectMax);
}

const TERBILANG_UNITS = [
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
  "Sebelas",
] as const;

/**
 * Terbilang Indonesia dengan huruf kapital di awal kata, mis. 7 -> "Tujuh".
 * Formulir rapor hanya butuh 0-10, tapi fungsi ini tetap wajar sampai ratusan
 * ribu dan tidak melempar error untuk angka di luar itu.
 */
export function terbilang(value: number): string {
  if (!Number.isFinite(value)) return "-";

  const n = Math.trunc(value);
  if (n < 0) return `Minus ${terbilang(-n)}`;
  if (n < TERBILANG_UNITS.length) return TERBILANG_UNITS[n];
  if (n < 20) return `${terbilang(n - 10)} Belas`;

  const withRest = (head: string, rest: number) => (rest === 0 ? head : `${head} ${terbilang(rest)}`);

  if (n < 100) return withRest(`${terbilang(Math.floor(n / 10))} Puluh`, n % 10);
  if (n < 200) return withRest("Seratus", n % 100);
  if (n < 1000) return withRest(`${terbilang(Math.floor(n / 100))} Ratus`, n % 100);
  if (n < 2000) return withRest("Seribu", n % 1000);
  if (n < 1_000_000) return withRest(`${terbilang(Math.floor(n / 1000))} Ribu`, n % 1000);

  // Di luar cakupan formulir rapor; tampilkan angkanya saja daripada gagal.
  return String(n);
}

/** Rekap ketidakhadiran sesuai formulir: Sakit, Izin, Lain-lain (alpa + terlambat). */
export type AttendanceRecap = { sickCount: number; excusedCount: number; otherCount: number };

export type AttendanceMarks = Record<AttendanceStatus, number>;

export function emptyMarks(): AttendanceMarks {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 };
}

export function recapFromMarks(marks: AttendanceMarks): AttendanceRecap {
  return {
    sickCount: marks.SICK,
    excusedCount: marks.EXCUSED,
    otherCount: marks.ABSENT + marks.LATE,
  };
}

/**
 * Bobot keparahan status kehadiran. Dipakai saat satu tanggal punya status
 * berbeda antar mapel (mis. SICK di mapel pagi, EXCUSED di mapel siang):
 * hari itu dihitung SEKALI memakai status paling berat, dari yang teringan
 * (hadir) sampai terberat (alpa tanpa keterangan).
 */
const STATUS_SEVERITY: Record<AttendanceStatus, number> = {
  PRESENT: 0,
  LATE: 1,
  EXCUSED: 2,
  SICK: 3,
  ABSENT: 4,
};

/** Status hari yang menang antara status lama dan status baru (paling berat). */
export function moreSevereStatus(
  current: AttendanceStatus | undefined,
  next: AttendanceStatus,
): AttendanceStatus {
  if (current === undefined) return next;
  return STATUS_SEVERITY[next] > STATUS_SEVERITY[current] ? next : current;
}

/**
 * Rekap ketidakhadiran dihitung per HARI (kolom formulir: "Jumlah Hari"), bukan
 * per sesi mapel. Santri sakit sehari yang punya 6 mapel tetap 1 hari sakit.
 * Kunci peta adalah tanggal kalender sesi, nilainya status terberat hari itu.
 */
export function recapFromDailyStatuses(
  statusByDate: ReadonlyMap<string, AttendanceStatus>,
): AttendanceRecap {
  const marks = emptyMarks();
  for (const status of statusByDate.values()) marks[status] += 1;
  return recapFromMarks(marks);
}

/** Baris nilai mapel siap simpan ke ReportCardEntry. */
export type DraftEntry = {
  courseId: string;
  courseTitle: string;
  groupName: string;
  groupSortOrder: number;
  finalScore: number;
  maxScore: number;
  scoreValue: number;
  scoreWords: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export type DraftBehaviorEntry = {
  criterionName: string;
  maxScore: number;
  scoreValue: number;
  sortOrder: number;
};

export type ReportDraft = {
  entries: DraftEntry[];
  behaviorEntries: DraftBehaviorEntry[];
  recap: AttendanceRecap;
};

/** Mapel belum dinilai sama sekali (bukan benar-benar mendapat nol). */
export function isUngraded(entry: { scoreWords: string }): boolean {
  return entry.scoreWords === UNGRADED_WORDS;
}

type CourseInput = {
  courseId: string;
  courseTitle: string;
  reportMaxScore: number | null;
  groupName: string | null;
  groupSortOrder: number | null;
  groupDefaultMaxScore: number | null;
  components: ScoreComponent[];
  marks: AttendanceMarks;
};

/**
 * Inti perhitungan rapor: dari data mentah per mapel menjadi baris rapor yang
 * sudah dikelompokkan dan diurutkan. Murni, tanpa Prisma.
 */
export function buildEntries(courses: readonly CourseInput[]): DraftEntry[] {
  const seenTitles = new Set<string>();
  const entries: DraftEntry[] = [];

  for (const course of courses) {
    // ReportCardEntry unik per (rapor, judul mapel); lewati judul kembar.
    if (seenTitles.has(course.courseTitle)) continue;
    seenTitles.add(course.courseTitle);

    const weighted = computeWeightedScore(course.components);
    const finalScore = weighted ?? 0;
    const maxScore = resolveSubjectMax(course.reportMaxScore, course.groupDefaultMaxScore);
    const scoreValue = weighted === null ? 0 : toScaleValue(finalScore, maxScore);

    entries.push({
      courseId: course.courseId,
      courseTitle: course.courseTitle,
      groupName: course.groupName ?? UNGROUPED_NAME,
      groupSortOrder: course.groupSortOrder ?? UNGROUPED_SORT_ORDER,
      finalScore,
      maxScore,
      scoreValue,
      scoreWords: weighted === null ? UNGRADED_WORDS : terbilang(scoreValue),
      present: course.marks.PRESENT,
      late: course.marks.LATE,
      absent: course.marks.ABSENT,
      excused: course.marks.EXCUSED,
    });
  }

  return entries.sort(
    (a, b) => a.groupSortOrder - b.groupSortOrder || a.courseTitle.localeCompare(b.courseTitle, "id"),
  );
}

/** Kelompokkan baris rapor per kelompok penilaian sesuai urutan formulir. */
export function groupEntries<T extends { groupName: string; groupSortOrder: number }>(entries: readonly T[]) {
  const groups = new Map<string, { name: string; sortOrder: number; entries: T[] }>();

  for (const entry of entries) {
    const group = groups.get(entry.groupName) ?? {
      name: entry.groupName,
      sortOrder: entry.groupSortOrder,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(entry.groupName, group);
  }

  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "id"));
}

/* -------------------------------------------------------------------------- */
/*                            query: penyusunan rapor                         */
/* -------------------------------------------------------------------------- */

/** Ambil data mentah satu santri satu periode lalu hitung isi rapornya. */
export async function buildReportDraft(studentId: string, period: Period): Promise<ReportDraft> {
  const [enrollments, behaviorGroups] = await Promise.all([
    prisma.enrollment.findMany({
      // Hanya enrolmen ACTIVE — sama seperti absensi & input nilai. Enrolmen
      // yang dibatalkan tidak boleh memunculkan baris rapor yang tak bisa dinilai.
      where: { studentId, status: EnrollmentStatus.ACTIVE, course: { deletedAt: null } },
      orderBy: { course: { title: "asc" } },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            reportMaxScore: true,
            assessmentGroup: { select: { name: true, sortOrder: true, defaultMaxScore: true, kind: true } },
            gradeItems: {
              where: { semester: period.semester, academicYear: period.academicYear },
              select: {
                maxScore: true,
                weight: true,
                records: { where: { studentId }, select: { score: true } },
              },
            },
            attendanceSessions: {
              where: { semester: period.semester, academicYear: period.academicYear },
              select: { heldAt: true, records: { where: { studentId }, select: { status: true } } },
            },
          },
        },
      },
    }),
    prisma.assessmentGroup.findMany({
      where: { academicYear: period.academicYear, kind: AssessmentGroupKind.BEHAVIOR },
      orderBy: { sortOrder: "asc" },
      select: {
        sortOrder: true,
        criteria: { orderBy: { sortOrder: "asc" }, select: { name: true, maxScore: true } },
      },
    }),
  ]);

  // Rekap rapor dihitung per tanggal (lintas mapel); counter per mapel di bawah
  // tetap per sesi karena kolomnya memang milik masing-masing mata pelajaran.
  const statusByDate = new Map<string, AttendanceStatus>();

  const courses: CourseInput[] = [];
  for (const { course } of enrollments) {
    const marks = emptyMarks();
    for (const session of course.attendanceSessions) {
      const record = session.records[0];
      if (!record) continue;
      marks[record.status] += 1;
      const dateKey = toDateKey(session.heldAt);
      statusByDate.set(dateKey, moreSevereStatus(statusByDate.get(dateKey), record.status));
    }

    // Mapel yang tertaut ke kelompok sikap tidak masuk tabel nilai mapel.
    if (course.assessmentGroup?.kind === AssessmentGroupKind.BEHAVIOR) continue;

    courses.push({
      courseId: course.id,
      courseTitle: course.title,
      reportMaxScore: course.reportMaxScore,
      groupName: course.assessmentGroup?.name ?? null,
      groupSortOrder: course.assessmentGroup?.sortOrder ?? null,
      groupDefaultMaxScore: course.assessmentGroup?.defaultMaxScore ?? null,
      // Hanya komponen yang punya nilai santri ini yang ikut dihitung.
      components: course.gradeItems
        .filter((item) => item.records.length > 0)
        .map((item) => ({ score: item.records[0].score, maxScore: item.maxScore, weight: item.weight })),
      marks,
    });
  }

  const seenCriteria = new Set<string>();
  const behaviorEntries: DraftBehaviorEntry[] = [];
  for (const group of behaviorGroups) {
    for (const criterion of group.criteria) {
      if (seenCriteria.has(criterion.name)) continue;
      seenCriteria.add(criterion.name);
      behaviorEntries.push({
        criterionName: criterion.name,
        maxScore: criterion.maxScore,
        // Nilai sikap diisi manual oleh wali kelas, bukan dihitung.
        scoreValue: 0,
        sortOrder: behaviorEntries.length + 1,
      });
    }
  }

  return { entries: buildEntries(courses), behaviorEntries, recap: recapFromDailyStatuses(statusByDate) };
}

/* -------------------------------------------------------------------------- */
/*                              query: administrasi                           */
/* -------------------------------------------------------------------------- */

export type AdministrationCheck = {
  id: string;
  name: string;
  description: string | null;
  fulfilled: boolean;
  note: string | null;
};

/** Checklist administrasi aktif satu santri pada satu periode. */
export const getStudentAdministration = cache(
  async (studentId: string, period: Period): Promise<AdministrationCheck[]> => {
    const items = await prisma.administrationItem.findMany({
      where: { academicYear: period.academicYear, semester: period.semester, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        records: { where: { studentId }, select: { fulfilled: true, note: true } },
      },
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      fulfilled: item.records[0]?.fulfilled ?? false,
      note: item.records[0]?.note ?? null,
    }));
  },
);

/** Nama item administrasi yang belum terpenuhi; kosong berarti boleh di-ACC. */
export function outstandingAdministration(items: readonly AdministrationCheck[]): string[] {
  return items.filter((item) => !item.fulfilled).map((item) => item.name);
}

/* -------------------------------------------------------------------------- */
/*                                query: papan rapor                          */
/* -------------------------------------------------------------------------- */

/** Wali kelas hanya boleh menyentuh kelas binaannya; administrasi melihat semua. */
export function canReviewReports(user: AuthUser) {
  return userCan(user, "report.approve") || userCan(user, "report.distribute");
}

/** true bila santri berada di kelas yang wali kelasnya user ini. */
export async function isHomeroomOf(userId: string, studentId: string): Promise<boolean> {
  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, classRoom: { homeroomTeacherId: userId } },
    select: { id: true },
  });
  return Boolean(student);
}

export type RaporBoardStudent = {
  studentId: string;
  name: string;
  studentNumber: string;
  level: string;
  reportCard: {
    id: string;
    status: ReportCardStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    publishedAt: Date | null;
  } | null;
};

/**
 * Daftar kelas yang boleh dilihat user + santri kelas terpilih beserta status
 * rapornya. Wali kelas tanpa kelas binaan mendapat daftar kosong.
 */
export const getRaporBoard = cache(async (user: AuthUser, period: Period, classRoomId?: string) => {
  const reviewer = canReviewReports(user);
  const manager = userCan(user, "report.manage");

  const classRooms =
    reviewer || manager
      ? await prisma.classRoom.findMany({
          where: {
            academicYear: period.academicYear,
            ...(reviewer ? {} : { homeroomTeacherId: user.id }),
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            level: true,
            homeroomTeacherId: true,
            homeroomTeacher: { select: { name: true } },
          },
        })
      : [];

  const activeClass = classRooms.find((room) => room.id === classRoomId) ?? classRooms[0] ?? null;

  if (!activeClass) {
    return { classRooms, activeClass: null, students: [] as RaporBoardStudent[] };
  }

  const students = await prisma.studentProfile.findMany({
    where: { classRoomId: activeClass.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      studentNumber: true,
      level: true,
      reportCards: {
        where: { semester: period.semester, academicYear: period.academicYear },
        select: { id: true, status: true, submittedAt: true, reviewedAt: true, publishedAt: true },
      },
    },
  });

  return {
    classRooms,
    activeClass,
    students: students.map((student) => ({
      studentId: student.id,
      name: student.name,
      studentNumber: student.studentNumber,
      level: student.level as string,
      reportCard: student.reportCards[0] ?? null,
    })) satisfies RaporBoardStudent[],
  };
});

/* -------------------------------------------------------------------------- */
/*                              query: lembar rapor                           */
/* -------------------------------------------------------------------------- */

export type SheetEntry = {
  id: string;
  courseTitle: string;
  groupName: string;
  groupSortOrder: number;
  finalScore: number;
  maxScore: number;
  scoreValue: number;
  scoreWords: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export type SheetBehaviorEntry = {
  id: string;
  criterionName: string;
  maxScore: number;
  scoreValue: number;
  sortOrder: number;
};

/** Data satu lembar rapor, dipakai tampilan staf maupun wali santri. */
export type RaporSheet = {
  id: string;
  semester: Semester;
  academicYear: string;
  status: ReportCardStatus;
  homeroomNote: string | null;
  adminNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  sickCount: number;
  excusedCount: number;
  otherCount: number;
  createdByName: string | null;
  reviewedByName: string | null;
  student: {
    id: string;
    name: string;
    studentNumber: string;
    className: string;
    level: string;
    classRoomId: string | null;
    homeroomTeacherId: string | null;
    /** Tahun ajaran kelas santri SEKARANG (bukan tahun ajaran rapor ini). */
    classAcademicYear: string | null;
  };
  entries: SheetEntry[];
  behaviorEntries: SheetBehaviorEntry[];
};

const sheetSelect = {
  id: true,
  semester: true,
  academicYear: true,
  status: true,
  homeroomNote: true,
  adminNote: true,
  submittedAt: true,
  reviewedAt: true,
  publishedAt: true,
  sickCount: true,
  excusedCount: true,
  otherCount: true,
  studentNameSnapshot: true,
  studentNumberSnapshot: true,
  classNameSnapshot: true,
  levelSnapshot: true,
  createdBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  student: {
    select: {
      id: true,
      name: true,
      studentNumber: true,
      className: true,
      level: true,
      classRoomId: true,
      classRoom: { select: { homeroomTeacherId: true, academicYear: true } },
    },
  },
  entries: {
    orderBy: [{ groupSortOrder: "asc" }, { courseTitle: "asc" }],
    select: {
      id: true,
      courseTitle: true,
      groupName: true,
      groupSortOrder: true,
      finalScore: true,
      maxScore: true,
      scoreValue: true,
      scoreWords: true,
      present: true,
      late: true,
      absent: true,
      excused: true,
    },
  },
  behaviorEntries: {
    orderBy: [{ sortOrder: "asc" }, { criterionName: "asc" }],
    select: { id: true, criterionName: true, maxScore: true, scoreValue: true, sortOrder: true },
  },
} satisfies Prisma.ReportCardSelect;

type SheetRow = Prisma.ReportCardGetPayload<{ select: typeof sheetSelect }>;

/** Status yang isinya masih boleh disusun ulang wali kelas. */
const EDITABLE_STATUSES: ReportCardStatus[] = [ReportCardStatus.DRAFT, ReportCardStatus.REJECTED];

/**
 * Identitas santri pada lembar rapor. Rapor yang sudah dikunci (SUBMITTED ke atas)
 * memakai snapshot yang diambil saat rapor disusun, supaya cetak ulang rapor tahun
 * lalu tetap menampilkan kelas santri saat itu — bukan kelasnya sekarang. Rapor
 * yang masih bisa disunting (DRAFT/REJECTED) justru harus mengikuti data santri
 * terkini, begitu pula rapor lama yang snapshot-nya masih kosong.
 */
function sheetIdentity(row: SheetRow) {
  const live = EDITABLE_STATUSES.includes(row.status);
  const pick = (snapshot: string | null, current: string) => (live ? current : (snapshot ?? current));

  return {
    name: pick(row.studentNameSnapshot, row.student.name),
    studentNumber: pick(row.studentNumberSnapshot, row.student.studentNumber),
    className: pick(row.classNameSnapshot, row.student.className),
    level: pick(row.levelSnapshot, row.student.level),
  };
}

function toSheet(row: SheetRow): RaporSheet {
  return {
    id: row.id,
    semester: row.semester,
    academicYear: row.academicYear,
    status: row.status,
    homeroomNote: row.homeroomNote,
    adminNote: row.adminNote,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    sickCount: row.sickCount,
    excusedCount: row.excusedCount,
    otherCount: row.otherCount,
    createdByName: row.createdBy?.name ?? null,
    reviewedByName: row.reviewedBy?.name ?? null,
    student: {
      id: row.student.id,
      ...sheetIdentity(row),
      classRoomId: row.student.classRoomId,
      homeroomTeacherId: row.student.classRoom?.homeroomTeacherId ?? null,
      classAcademicYear: row.student.classRoom?.academicYear ?? null,
    },
    entries: row.entries,
    behaviorEntries: row.behaviorEntries,
  };
}

/** Lembar rapor untuk staf (semua status). */
export const getRaporSheet = cache(async (reportCardId: string): Promise<RaporSheet | null> => {
  const row = await prisma.reportCard.findUnique({ where: { id: reportCardId }, select: sheetSelect });
  return row ? toSheet(row) : null;
});

/**
 * Rapor PUBLISHED milik satu anak — hanya bila anak itu benar milik wali yang
 * meminta (kepemilikan diverifikasi persis seperti getChildReportCards lama).
 */
export const getChildRaporSheets = cache(
  async (parentId: string, childId: string): Promise<RaporSheet[] | null> => {
    const child = await prisma.studentProfile.findFirst({
      where: { id: childId, parentId },
      select: { id: true },
    });
    if (!child) return null;

    const rows = await prisma.reportCard.findMany({
      where: { studentId: childId, status: ReportCardStatus.PUBLISHED },
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
      select: sheetSelect,
    });

    return rows.map(toSheet);
  },
);
