import { cache } from "react";
import {
  AdmissionStatus,
  AttendanceStatus,
  CourseStatus,
  EducationLevel,
  EnrollmentStatus,
  Semester,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, type AuthUser } from "@/lib/auth";

/* -------------------------------------------------------------------------- */
/*                                   helpers                                  */
/* -------------------------------------------------------------------------- */

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
// Bars shown on the dashboard activity chart (Mon–Sat).
const WEEK_BARS = [1, 2, 3, 4, 5, 6] as const;

/** Ustadz/wali kelas berpengampu mata pelajaran sendiri (dulu role TEACHER/HOMEROOM). */
function isTeachingStaff(user: AuthUser) {
  return userCan(user, "grade.manage") || userCan(user, "attendance.record");
}

/** Nilai untuk <input type="datetime-local"> (waktu lokal server). */
function toDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Persen 0-100 dari nilai mentah pada skala komponennya. Diklem sebagai
 * pertahanan berlapis: data lama yang terlanjur melebihi maxScore (mis. karena
 * maxScore pernah diubah tanpa penskalaan ulang) tidak boleh tampil di atas 100.
 */
function scorePercent(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0;
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}

export function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  if (day === 1) return "kemarin";
  if (day < 7) return `${day} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}

/* -------------------------------------------------------------------------- */
/*                          periode (semester + tahun ajaran)                 */
/* -------------------------------------------------------------------------- */

export type Period = { semester: Semester; academicYear: string };

/** Juli-Desember = GANJIL tahun ajaran berjalan; Januari-Juni = GENAP tahun ajaran sebelumnya. */
export function getCurrentPeriod(now = new Date()): Period {
  const year = now.getFullYear();
  const isFirstHalfOfSchoolYear = now.getMonth() >= 6;
  return isFirstHalfOfSchoolYear
    ? { semester: Semester.GANJIL, academicYear: `${year}/${year + 1}` }
    : { semester: Semester.GENAP, academicYear: `${year - 1}/${year}` };
}

export function formatPeriod(period: Period) {
  return `Semester ${period.semester === Semester.GANJIL ? "Ganjil" : "Genap"} ${period.academicYear}`;
}

/* -------------------------------------------------------------------------- */
/*                                  dashboard                                 */
/* -------------------------------------------------------------------------- */

export const getDashboardData = cache(async (user: AuthUser) => {
  const now = new Date();
  const todayDow = now.getDay();
  const today = dateKeyToDb(toDateKey(now));
  const weekStart = new Date(Date.now() - 28 * 864e5);

  // Independent, non-mutually-exclusive permission flags: one user can hold several.
  const canReviewAdmissions = userCan(user, "admission.review");
  const canManageUsers = userCan(user, "user.manage");
  const canManageCourses = userCan(user, "course.manage");
  const canRecordStaffAttendance = userCan(user, "staff_attendance.record");
  const canViewStaffAttendance = userCan(user, "staff_attendance.view");
  const canManageReports = userCan(user, "report.manage");
  const canMonitorChildren = userCan(user, "child.monitor");
  const canManageGrades = userCan(user, "grade.manage");
  const canRecordAttendance = userCan(user, "attendance.record");

  // Section triggers: an "admin-ish" section (PPDB/akun) and a "mudir-ish" section
  // (kelola mapel/jadwal + kehadiran ustadz) can both be true for the same user.
  const showAdminSection = canManageUsers || canReviewAdmissions;
  const showMudirSection = canManageCourses;
  const oversightMode = canViewStaffAttendance;
  const teacherScope = isTeachingStaff(user) ? { teacherId: user.id } : {};

  const [
    schedule,
    deadlines,
    attendanceSessionsForWeek,
    recentGradeItems,
    recentSessions,
    recentVerified,
    students,
    pendingUsers,
    pendingAdmissions,
    totalUsers,
    courses,
    attendanceGroups,
    staffCount,
    staffAttendanceToday,
    bkkhToday,
    staffAttendanceForWeek,
  ] = await Promise.all([
      prisma.scheduleSlot.findMany({
        where: { dayOfWeek: todayDow, course: { deletedAt: null, ...teacherScope } },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          startTime: true,
          room: true,
          course: { select: { id: true, title: true, teacher: { select: { name: true } } } },
        },
      }),
      !showAdminSection && canManageGrades
        ? prisma.gradeItem.findMany({
            where: { dueAt: { gte: now }, course: { ...teacherScope } },
            orderBy: { dueAt: "asc" },
            take: 4,
            select: { id: true, title: true, dueAt: true, course: { select: { title: true } } },
          })
        : Promise.resolve([]),
      prisma.attendanceSession.findMany({
        where: { heldAt: { gte: weekStart }, course: { deletedAt: null, ...teacherScope } },
        select: { heldAt: true },
      }),
      showAdminSection || canManageGrades
        ? prisma.gradeItem.findMany({
            where: { course: { ...teacherScope } },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { title: true, createdAt: true, course: { select: { title: true, teacher: { select: { name: true } } } } },
          })
        : Promise.resolve([]),
      showAdminSection || canRecordAttendance
        ? prisma.attendanceSession.findMany({
            where: { course: { ...teacherScope } },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { title: true, createdAt: true, course: { select: { title: true } } },
          })
        : Promise.resolve([]),
      showAdminSection
        ? prisma.user.findMany({
            where: { status: UserStatus.VERIFIED, verifiedAt: { not: null } },
            orderBy: { verifiedAt: "desc" },
            take: 5,
            select: { name: true, verifiedAt: true },
          })
        : Promise.resolve([]),
      showAdminSection ? prisma.studentProfile.count() : Promise.resolve(0),
      showAdminSection ? prisma.user.count({ where: { status: UserStatus.PENDING } }) : Promise.resolve(0),
      showAdminSection ? prisma.admission.count({ where: { status: AdmissionStatus.PENDING } }) : Promise.resolve(0),
      showAdminSection ? prisma.user.count() : Promise.resolve(0),
      prisma.course.findMany({
        where: { deletedAt: null, status: CourseStatus.PUBLISHED, ...teacherScope },
        orderBy: { createdAt: "desc" },
        take: 6,
        // Hanya enrolmen ACTIVE yang dihitung: santri yang enrolmennya dibatalkan
        // sudah hilang dari rapor & papan nilai, jadi tidak boleh ikut terhitung.
        select: { id: true, title: true, _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } } },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: isTeachingStaff(user) ? { attendanceSession: { course: { teacherId: user.id } } } : undefined,
        _count: { status: true },
      }),
      oversightMode
        ? prisma.user.count({ where: { roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] }, status: UserStatus.VERIFIED } })
        : Promise.resolve(0),
      oversightMode
        ? prisma.staffAttendance.groupBy({ by: ["status"], where: { date: today }, _count: { status: true } })
        : Promise.resolve([]),
      oversightMode ? prisma.bkkhReport.count({ where: { date: today } }) : Promise.resolve(0),
      oversightMode
        ? prisma.staffAttendance.findMany({ where: { date: { gte: weekStart } }, select: { date: true } })
        : Promise.resolve([]),
    ]);

  const buckets = new Map<number, number>();
  if (oversightMode) {
    for (const record of staffAttendanceForWeek) {
      const dow = record.date.getUTCDay();
      buckets.set(dow, (buckets.get(dow) ?? 0) + 1);
    }
  } else {
    for (const session of attendanceSessionsForWeek) {
      const dow = session.heldAt.getDay();
      buckets.set(dow, (buckets.get(dow) ?? 0) + 1);
    }
  }
  const weekData = WEEK_BARS.map((dow) => ({ l: WEEKDAY_LABELS[dow], v: buckets.get(dow) ?? 0 }));
  const maxVal = Math.max(0, ...weekData.map((d) => d.v));
  const weeklyActivity = weekData.map((d) => ({ ...d, hot: d.v > 0 && d.v === maxVal }));

  // Activity feed: merge recent records.
  type FeedItem = { who: string; text: string; at: Date; tag: string };
  const feedRaw: FeedItem[] = [
    ...recentGradeItems.map((g) => ({
      who: g.course.teacher?.name ?? "Ustadz",
      text: `menambahkan komponen nilai "${g.title}" di ${g.course.title}`,
      at: g.createdAt,
      tag: "Nilai",
    })),
    ...recentSessions.map((s) => ({
      who: "Operator",
      text: `membuat sesi absensi "${s.title}" di ${s.course.title}`,
      at: s.createdAt,
      tag: "Absensi",
    })),
    ...recentVerified.map((u) => ({
      who: "Administrasi",
      text: `memverifikasi akun ${u.name}`,
      at: u.verifiedAt as Date,
      tag: "Sistem",
    })),
  ];
  const activity = feedRaw.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 5);

  const attendanceTotal = attendanceGroups.reduce((sum, group) => sum + group._count.status, 0);
  const present = attendanceGroups.find((group) => group.status === AttendanceStatus.PRESENT)?._count.status ?? 0;
  const attRate = attendanceTotal ? Math.round((present / attendanceTotal) * 100) : 0;
  const staffPresent = staffAttendanceToday.find((group) => group.status === AttendanceStatus.PRESENT)?._count.status ?? 0;
  const staffLate = staffAttendanceToday.find((group) => group.status === AttendanceStatus.LATE)?._count.status ?? 0;
  const staffAbsent = staffAttendanceToday.find((group) => group.status === AttendanceStatus.ABSENT)?._count.status ?? 0;
  const staffMarked = staffAttendanceToday.reduce((sum, group) => sum + group._count.status, 0);
  const participantCount = courses.reduce((sum, course) => sum + course._count.enrollments, 0);

  // Sections stack: a user holding both admin-ish and mudir-ish permissions
  // (e.g. ADMIN + MUDIR) sees both tile sets instead of one overwriting the other.
  type StatTile = { label: string; value: string; delta?: string; up?: boolean; tone: string; icon: string };
  let stats: StatTile[] = [];
  const heroCandidates: { value: number; label: string }[] = [];

  if (showAdminSection) {
    stats = stats.concat([
      { label: "PPDB Menunggu", value: String(pendingAdmissions), tone: "var(--amber)", icon: "doc", delta: pendingAdmissions ? "perlu tinjauan" : undefined },
      { label: "Akun Menunggu", value: String(pendingUsers), tone: "var(--amber)", icon: "award", delta: pendingUsers ? "perlu verifikasi" : undefined },
      { label: "Total Pengguna", value: String(totalUsers), tone: "var(--primary)", icon: "users" },
      { label: "Santri Aktif", value: String(students), tone: "var(--green)", icon: "book" },
    ]);
    heroCandidates.push({ value: staffCount ? Math.round((staffMarked / staffCount) * 100) : 0, label: "Absensi Ustadz Tercatat" });
  }
  if (showMudirSection) {
    const followUp = Math.max(0, staffCount - staffMarked) + staffLate + staffAbsent;
    stats = stats.concat([
      { label: "Ustadz Aktif", value: String(staffCount), tone: "var(--primary)", icon: "users" },
      { label: "Hadir Hari Ini", value: String(staffPresent), tone: "var(--green)", icon: "check2" },
      { label: "BKKH Masuk", value: String(bkkhToday), tone: "var(--teal)", icon: "doc" },
      { label: "Perlu Tindak Lanjut", value: String(followUp), tone: "var(--amber)", icon: "award", delta: followUp ? "perlu diperiksa" : undefined },
    ]);
    heroCandidates.push({ value: staffCount ? Math.round((bkkhToday / staffCount) * 100) : 0, label: "Kelengkapan BKKH" });
  }
  if (!showAdminSection && !showMudirSection) {
    stats = [
      { label: isTeachingStaff(user) ? "Mapel Diampu" : "Mata Pelajaran", value: String(courses.length), tone: "var(--primary)", icon: "book" },
      { label: "Peserta Mapel", value: String(participantCount), tone: "var(--teal)", icon: "users" },
      { label: "Sesi 4 Pekan", value: String(attendanceSessionsForWeek.length), tone: "var(--amber)", icon: "calendar" },
      { label: "Rata Kehadiran", value: `${attRate}%`, tone: "var(--green)", icon: "check2" },
    ];
  }
  const hero = heroCandidates[0] ?? { value: attRate, label: "Tingkat Kehadiran" };
  const courseSummaries = courses.map((c) => ({ id: c.id, title: c.title, students: c._count.enrollments }));

  return {
    stats,
    hero,
    // Independent capability flags so the dashboard page can stack whichever
    // sections apply to this user, instead of one role overwriting another.
    canReviewAdmissions,
    canManageUsers,
    canManageCourses,
    canRecordStaffAttendance,
    canViewStaffAttendance,
    canManageReports,
    canMonitorChildren,
    canManageGrades,
    canRecordAttendance,
    weeklyTitle: oversightMode ? "Kehadiran Ustadz" : "Aktivitas Mingguan",
    weeklySub: oversightMode ? "Catatan kehadiran dalam empat pekan terakhir" : "Sesi kelas tercatat per hari",
    courses: courseSummaries,
    weeklyActivity,
    schedule: schedule.map((s) => ({
      id: s.id,
      time: s.startTime.replace(".", ":"),
      title: s.course.title,
      room: s.room ?? "-",
      teacher: s.course.teacher?.name ?? "Belum ditugaskan",
    })),
    deadlines: deadlines.map((d) => ({
      id: d.id,
      title: d.title,
      course: d.course.title,
      due: d.dueAt ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d.dueAt) : "-",
    })),
    activity: activity.map((a) => ({ who: a.who, text: a.text, when: formatRelative(a.at), tag: a.tag })),
  };
});

/* -------------------------------------------------------------------------- */
/*                          mata pelajaran (courses)                          */
/* -------------------------------------------------------------------------- */

export const getCourseOverview = cache(async (user: AuthUser) => {
  const courses = await prisma.course.findMany({
    where: { deletedAt: null, ...(isTeachingStaff(user) ? { teacherId: user.id } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      level: true,
      classRoomId: true,
      classRoom: { select: { name: true } },
      teacherId: true,
      teacher: { select: { name: true } },
      // Jumlah santri = enrolmen ACTIVE saja, sama seperti daftar peserta di
      // halaman detail mapel dan penilaian.
      _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } }, scheduleSlots: true } },
    },
  });

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    level: c.level,
    classRoomId: c.classRoomId,
    className: c.classRoom?.name ?? null,
    assigned: Boolean(c.teacherId),
    teacher: c.teacher?.name ?? "Belum ditugaskan",
    students: c._count.enrollments,
    scheduleSlots: c._count.scheduleSlots,
  }));
});

export const getTeachingStaff = cache(async () => {
  return prisma.user.findMany({
    where: { roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] }, status: UserStatus.VERIFIED },
    orderBy: { name: "asc" },
    select: { id: true, name: true, roles: true },
  });
});

/* -------------------------------------------------------------------------- */
/*                        mudir/teacher course management                     */
/* -------------------------------------------------------------------------- */

export const getCourseManagement = cache(async (courseId: string, user: AuthUser) => {
  const canManage = userCan(user, "course.manage");
  const [course, teachingStaff] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, deletedAt: null, ...(canManage ? {} : { teacherId: user.id }) },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        level: true,
        status: true,
        classRoom: { select: { id: true, name: true } },
        teacherId: true,
        teacher: { select: { name: true } },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          orderBy: { student: { name: "asc" } },
          select: {
            id: true,
            student: { select: { id: true, name: true, studentNumber: true, className: true } },
          },
        },
      },
    }),
    canManage ? getTeachingStaff() : Promise.resolve([]),
  ]);
  return { course, teachingStaff, canManage };
});

/* -------------------------------------------------------------------------- */
/*                                  gradebook                                  */
/* -------------------------------------------------------------------------- */

async function courseTabsFor(user: AuthUser) {
  return prisma.course.findMany({
    where: { deletedAt: null, ...(isTeachingStaff(user) ? { teacherId: user.id } : {}) },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}

export type GradeColumn = {
  id: string;
  title: string;
  maxScore: number;
  weight: number;
  /** Nilai untuk <input type="date">, "" bila tanpa tenggat. */
  dueAt: string;
  recordCount: number;
};
export type GradeRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  scores: (number | null)[];
  avg: number;
};

export const getGradebook = cache(async (user: AuthUser, courseId?: string) => {
  const courses = await courseTabsFor(user);
  const activeCourseId = courseId && courses.some((c) => c.id === courseId) ? courseId : courses[0]?.id ?? null;

  if (!activeCourseId) {
    return {
      courses,
      activeCourseId: null,
      columns: [] as GradeColumn[],
      rows: [] as GradeRow[],
      canEdit: false,
      teacherName: null as string | null,
      weightTotal: 0,
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: activeCourseId },
    select: {
      teacherId: true,
      teacher: { select: { name: true } },
      gradeItems: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          maxScore: true,
          weight: true,
          dueAt: true,
          records: { select: { studentId: true, score: true } },
        },
      },
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE },
        orderBy: { student: { name: "asc" } },
        select: { student: { select: { id: true, name: true, studentNumber: true } } },
      },
    },
  });

  // Hanya pengampu yang ditugaskan pada mapel ini yang boleh mengubah nilai,
  // sama persis dengan pagar di server action-nya.
  const canEdit = userCan(user, "grade.manage") && course?.teacherId === user.id;

  const columns: GradeColumn[] = (course?.gradeItems ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    maxScore: g.maxScore,
    weight: g.weight,
    dueAt: g.dueAt ? toDateKey(g.dueAt) : "",
    recordCount: g.records.length,
  }));
  const recordsByGradeItem = new Map(
    (course?.gradeItems ?? []).map((g) => [g.id, new Map(g.records.map((record) => [record.studentId, record.score]))]),
  );
  const rows: GradeRow[] = (course?.enrollments ?? []).map((e) => {
    const scores = (course?.gradeItems ?? []).map((g) => {
      const score = recordsByGradeItem.get(g.id)?.get(e.student.id);
      return score === undefined ? null : Math.round(scorePercent(score, g.maxScore));
    });
    const present = scores.filter((s): s is number => s !== null);
    const avg = present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : 0;
    return {
      studentId: e.student.id,
      name: e.student.name,
      studentNumber: e.student.studentNumber,
      scores,
      avg,
    };
  });

  return {
    courses,
    activeCourseId,
    columns,
    rows,
    canEdit,
    teacherName: course?.teacher?.name ?? null,
    weightTotal: columns.reduce((sum, c) => sum + c.weight, 0),
  };
});

/* -------------------------------------------------------------------------- */
/*                                 attendance                                  */
/* -------------------------------------------------------------------------- */

export type AttendanceStatusKey = AttendanceStatus | "UNMARKED";
export type AttendanceCounts = Record<AttendanceStatusKey, number>;

function emptyAttendanceCounts(): AttendanceCounts {
  return { PRESENT: 0, EXCUSED: 0, SICK: 0, LATE: 0, ABSENT: 0, UNMARKED: 0 };
}

const attendanceShortFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" });
const attendanceLongFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const attendanceTimeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

export type AttendanceSessionColumn = {
  id: string;
  title: string;
  /** "12 Sep" — label ringkas untuk kolom matriks. */
  date: string;
  /** "Jumat, 12 September 2026" — label lengkap untuk mode per sesi. */
  dateFull: string;
  /** "2026-09-12" — dipakai filter & nama berkas ekspor. */
  dateKey: string;
  /** "07.30" */
  time: string;
  /** Nilai untuk <input type="datetime-local">. */
  heldAt: string;
  recordCount: number;
  /** Rekap status sesi ini, hanya atas santri yang masih aktif terdaftar. */
  counts: AttendanceCounts;
};

export type AttendanceRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  /** null = belum ditandai sama sekali (bukan hadir). */
  marks: (AttendanceStatus | null)[];
  /** Keterangan per sesi, sejajar dengan marks. */
  notes: (string | null)[];
  counts: AttendanceCounts;
  /** Persentase hadir atas sesi yang sudah ditandai; null bila belum ada satu pun. */
  rate: number | null;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateKey(value?: string): string | null {
  return value && DATE_KEY_RE.test(value) ? value : null;
}

/** Rentang sesi yang ditampilkan; batas hari dihitung di zona waktu server, sama seperti heldAt. */
function heldAtRange(from: string | null, to: string | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };
}

export const getAttendanceBoard = cache(async (user: AuthUser, courseId?: string, from?: string, to?: string) => {
  const courses = await courseTabsFor(user);
  const activeCourseId = courseId && courses.some((c) => c.id === courseId) ? courseId : courses[0]?.id ?? null;
  const fromKey = normalizeDateKey(from);
  const toKey = normalizeDateKey(to);

  if (!activeCourseId) {
    return {
      courses,
      activeCourseId: null,
      sessions: [] as AttendanceSessionColumn[],
      rows: [] as AttendanceRow[],
      canEdit: false,
      teacherName: null as string | null,
      totals: emptyAttendanceCounts(),
      range: { from: fromKey, to: toKey },
      bounds: { first: null as string | null, last: null as string | null, total: 0 },
    };
  }

  const [course, bounds] = await Promise.all([
    prisma.course.findUnique({
      where: { id: activeCourseId },
      select: {
        teacherId: true,
        teacher: { select: { name: true } },
        attendanceSessions: {
          where: { heldAt: heldAtRange(fromKey, toKey) },
          orderBy: { heldAt: "asc" },
          select: { id: true, title: true, heldAt: true, records: { select: { studentId: true, status: true, note: true } } },
        },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          orderBy: { student: { name: "asc" } },
          select: { student: { select: { id: true, name: true, studentNumber: true } } },
        },
      },
    }),
    // Batas tanggal seluruh sesi (tanpa filter) supaya UI filter tahu rentang yang tersedia.
    prisma.attendanceSession.aggregate({
      where: { courseId: activeCourseId },
      _min: { heldAt: true },
      _max: { heldAt: true },
      _count: { _all: true },
    }),
  ]);

  // Hanya pengampu yang ditugaskan pada mapel ini yang boleh mencatat absensi,
  // sama persis dengan pagar di server action-nya.
  const canEdit = userCan(user, "attendance.record") && course?.teacherId === user.id;

  const sessionsRaw = course?.attendanceSessions ?? [];
  const recordsBySession = new Map(sessionsRaw.map((s) => [s.id, new Map(s.records.map((record) => [record.studentId, record]))]));

  // Rekap kolom dihitung dari baris yang tampil, jadi catatan milik santri yang
  // sudah tidak aktif terdaftar tidak ikut membengkakkan angka sesi.
  const sessionCounts = sessionsRaw.map(() => emptyAttendanceCounts());
  const totals = emptyAttendanceCounts();

  const rows: AttendanceRow[] = (course?.enrollments ?? []).map((e) => {
    const counts = emptyAttendanceCounts();
    const marks: (AttendanceStatus | null)[] = [];
    const notes: (string | null)[] = [];
    sessionsRaw.forEach((s, i) => {
      const record = recordsBySession.get(s.id)?.get(e.student.id) ?? null;
      const key: AttendanceStatusKey = record?.status ?? "UNMARKED";
      marks.push(record?.status ?? null);
      notes.push(record?.note ?? null);
      counts[key] += 1;
      sessionCounts[i][key] += 1;
      totals[key] += 1;
    });
    const recorded = sessionsRaw.length - counts.UNMARKED;
    return {
      studentId: e.student.id,
      name: e.student.name,
      studentNumber: e.student.studentNumber,
      marks,
      notes,
      counts,
      rate: recorded ? Math.round((counts.PRESENT / recorded) * 100) : null,
    };
  });

  const sessions: AttendanceSessionColumn[] = sessionsRaw.map((s, i) => ({
    id: s.id,
    title: s.title,
    date: attendanceShortFmt.format(s.heldAt),
    dateFull: attendanceLongFmt.format(s.heldAt),
    dateKey: toDateKey(s.heldAt),
    time: attendanceTimeFmt.format(s.heldAt),
    heldAt: toDateTimeInput(s.heldAt),
    recordCount: s.records.length,
    counts: sessionCounts[i],
  }));

  return {
    courses,
    activeCourseId,
    sessions,
    rows,
    canEdit,
    teacherName: course?.teacher?.name ?? null,
    totals,
    range: { from: fromKey, to: toKey },
    bounds: {
      first: bounds._min.heldAt ? toDateKey(bounds._min.heldAt) : null,
      last: bounds._max.heldAt ? toDateKey(bounds._max.heldAt) : null,
      total: bounds._count._all,
    },
  };
});

/* -------------------------------------------------------------------------- */
/*                              users management                              */
/* -------------------------------------------------------------------------- */

export const getManagedUsers = cache(async () => {
  return prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      status: true,
      createdAt: true,
    },
  });
});

/* -------------------------------------------------------------------------- */
/*                                  profile                                    */
/* -------------------------------------------------------------------------- */

export const getProfile = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
    },
  });
});

/* -------------------------------------------------------------------------- */
/*                              parent (wali santri)                          */
/* -------------------------------------------------------------------------- */

function rate(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

/** Summary cards for each child linked to a parent. */
export const getParentChildren = cache(async (parentId: string) => {
  const children = await prisma.studentProfile.findMany({
    where: { parentId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      level: true,
      className: true,
      studentNumber: true,
      // Hanya enrolmen ACTIVE: mapel yang enrolmennya dibatalkan sudah tidak
      // muncul di rapor maupun di halaman rincian anak.
      _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
    },
  });
  const childIds = children.map((child) => child.id);
  const [activeEnrollments, gradeRecords, attendanceRecords] = childIds.length
    ? await Promise.all([
        prisma.enrollment.findMany({
          where: { studentId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
          select: { studentId: true, courseId: true },
        }),
        prisma.gradeRecord.findMany({
          where: { studentId: { in: childIds } },
          select: { studentId: true, score: true, gradeItem: { select: { courseId: true, maxScore: true } } },
        }),
        prisma.attendanceRecord.findMany({
          where: { studentId: { in: childIds } },
          select: { studentId: true, status: true, attendanceSession: { select: { courseId: true } } },
        }),
      ])
    : [[], [], []];
  // Catatan nilai/kehadiran milik enrolmen yang dibatalkan tetap tersimpan, tapi
  // tidak boleh ikut dirata-rata: mapelnya sudah tidak diikuti santri ini lagi.
  const enrollmentKey = (studentId: string, courseId: string) => `${studentId}:${courseId}`;
  const activeCourses = new Set(activeEnrollments.map((e) => enrollmentKey(e.studentId, e.courseId)));
  const gradesByChild = new Map<string, { sum: number; count: number }>();
  for (const record of gradeRecords) {
    if (!activeCourses.has(enrollmentKey(record.studentId, record.gradeItem.courseId))) continue;
    const current = gradesByChild.get(record.studentId) ?? { sum: 0, count: 0 };
    current.sum += scorePercent(record.score, record.gradeItem.maxScore);
    current.count += 1;
    gradesByChild.set(record.studentId, current);
  }
  const attendanceByChild = new Map<string, { present: number; total: number }>();
  for (const record of attendanceRecords) {
    if (!activeCourses.has(enrollmentKey(record.studentId, record.attendanceSession.courseId))) continue;
    const current = attendanceByChild.get(record.studentId) ?? { present: 0, total: 0 };
    current.total += 1;
    if (record.status === AttendanceStatus.PRESENT) current.present += 1;
    attendanceByChild.set(record.studentId, current);
  }

  return children.map((c) => {
    const grades = gradesByChild.get(c.id) ?? { sum: 0, count: 0 };
    const avg = grades.count ? Math.round(grades.sum / grades.count) : 0;
    const att = attendanceByChild.get(c.id) ?? { present: 0, total: 0 };
    return {
      childId: c.id,
      name: c.name,
      level: c.level,
      className: c.className,
      studentNumber: c.studentNumber,
      courses: c._count.enrollments,
      avg,
      attRate: rate(att.present, att.total),
    };
  });
});

/** Full report for one child, only if it belongs to the requesting parent. */
export const getChildDetail = cache(async (parentId: string, childId: string) => {
  const profile = await prisma.studentProfile.findFirst({
    where: { id: childId, parentId },
    select: {
      id: true,
      name: true,
      level: true,
      className: true,
      studentNumber: true,
      phone: true,
    },
  });
  if (!profile) return null;

  const enrollments = await prisma.enrollment.findMany({
    // Hanya enrolmen ACTIVE — sama seperti buildReportDraft. Mapel yang
    // enrolmennya dibatalkan tidak boleh tampil di portal wali padahal sudah
    // hilang dari rapor cetak.
    where: { studentId: childId, status: EnrollmentStatus.ACTIVE, course: { deletedAt: null } },
    orderBy: { course: { title: "asc" } },
    select: {
      course: {
        select: {
          id: true,
          title: true,
          teacher: { select: { name: true } },
          gradeItems: {
            orderBy: { createdAt: "asc" },
            select: { id: true, title: true, maxScore: true, records: { where: { studentId: childId }, select: { score: true } } },
          },
          attendanceSessions: {
            orderBy: { heldAt: "asc" },
            select: { id: true, title: true, heldAt: true, records: { where: { studentId: childId }, select: { status: true } } },
          },
        },
      },
    },
  });

  let gradeSum = 0;
  let gradeCount = 0;
  let attPresent = 0;
  let attTotal = 0;

  const courses = enrollments.map((e) => {
    const grades = e.course.gradeItems.map((g) => {
      const rec = g.records[0];
      const value = rec ? Math.round(scorePercent(rec.score, g.maxScore)) : null;
      if (value !== null) {
        gradeSum += value;
        gradeCount += 1;
      }
      return { id: g.id, title: g.title, value };
    });
    const present = grades.filter((g) => g.value !== null);
    const courseAvg = present.length ? Math.round(present.reduce((s, g) => s + (g.value as number), 0) / present.length) : 0;

    const marks = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, SICK: 0 } satisfies Record<AttendanceStatus, number>;
    for (const s of e.course.attendanceSessions) {
      const rec = s.records[0];
      if (rec) {
        marks[rec.status] += 1;
        attTotal += 1;
        if (rec.status === AttendanceStatus.PRESENT) attPresent += 1;
      }
    }
    const courseAttTotal = marks.PRESENT + marks.LATE + marks.ABSENT + marks.EXCUSED + marks.SICK;

    return {
      id: e.course.id,
      title: e.course.title,
      teacher: e.course.teacher?.name ?? "Belum ditugaskan",
      grades,
      courseAvg,
      marks,
      attRate: rate(marks.PRESENT, courseAttTotal),
    };
  });

  return {
    child: {
      id: profile.id,
      name: profile.name,
      level: profile.level,
      className: profile.className,
      studentNumber: profile.studentNumber,
    },
    overall: { avg: gradeCount ? Math.round(gradeSum / gradeCount) : 0, attRate: rate(attPresent, attTotal) },
    courses,
  };
});

/* -------------------------------------------------------------------------- */
/*                            schedule (penjadwalan)                          */
/* -------------------------------------------------------------------------- */

const DAY_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

/** Papan jadwal per hari (dayOfWeek 0 = Ahad, mengikuti Date.getDay()). */
export const getScheduleBoard = cache(async (user: AuthUser, level?: EducationLevel) => {
  const teacherScope = isTeachingStaff(user) ? { teacherId: user.id } : {};
  const [slots, courses] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { course: { deletedAt: null, ...teacherScope, ...(level ? { level } : {}) } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        course: { select: { id: true, title: true, level: true, teacher: { select: { name: true } } } },
      },
    }),
    prisma.course.findMany({
      where: { deletedAt: null, ...teacherScope },
      orderBy: { title: "asc" },
      select: { id: true, title: true, level: true, classRoom: { select: { name: true } } },
    }),
  ]);

  const days = DAY_NAMES.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    slots: slots
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .map((s) => ({
        id: s.id,
        startTime: s.startTime.replace(".", ":"),
        endTime: s.endTime.replace(".", ":"),
        room: s.room,
        courseId: s.course.id,
        courseTitle: s.course.title,
        level: s.course.level,
        teacher: s.course.teacher?.name ?? "Belum ditugaskan",
      })),
  }));

  return { days, courses };
});

/** Jadwal per anak untuk wali: hanya mapel yang diikuti anaknya sendiri. */
export const getParentScheduleBoard = cache(async (parentId: string) => {
  const children = await prisma.studentProfile.findMany({
    where: { parentId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      className: true,
      level: true,
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE, course: { deletedAt: null } },
        select: {
          course: {
            select: {
              id: true,
              title: true,
              teacher: { select: { name: true } },
              scheduleSlots: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true, room: true } },
            },
          },
        },
      },
    },
  });

  return children.map((child) => {
    const slots = child.enrollments.flatMap((e) =>
      e.course.scheduleSlots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime.replace(".", ":"),
        endTime: s.endTime.replace(".", ":"),
        room: s.room,
        courseId: e.course.id,
        courseTitle: e.course.title,
        teacher: e.course.teacher?.name ?? "Belum ditugaskan",
      })),
    );
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      childId: child.id,
      name: child.name,
      className: child.className,
      level: child.level,
      days: DAY_NAMES.map((label, dayOfWeek) => ({
        dayOfWeek,
        label,
        slots: slots.filter((s) => s.dayOfWeek === dayOfWeek),
      })),
    };
  });
});

/* -------------------------------------------------------------------------- */
/*                          absensi ustadz (staff)                            */
/* -------------------------------------------------------------------------- */

const STAFF_ROLES = [UserRole.TEACHER, UserRole.HOMEROOM] as const;

/** Kunci tanggal lokal "YYYY-MM-DD". */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Kolom bertipe DATE disimpan sebagai tengah malam UTC oleh Prisma. */
export function dateKeyToDb(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Daftar ustadz (pengajar + wali kelas) beserta status kehadiran pada satu tanggal. */
export const getStaffAttendanceBoard = cache(async (dateKey: string) => {
  const date = dateKeyToDb(dateKey);
  const [teachers, records] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { hasSome: [...STAFF_ROLES] }, status: UserStatus.VERIFIED },
      orderBy: { name: "asc" },
      select: { id: true, name: true, roles: true },
    }),
    prisma.staffAttendance.findMany({
      where: { date },
      select: { teacherId: true, status: true, note: true },
    }),
  ]);
  const byTeacher = new Map(records.map((r) => [r.teacherId, r]));
  return teachers.map((t) => ({
    id: t.id,
    name: t.name,
    roles: t.roles,
    status: byTeacher.get(t.id)?.status ?? null,
    note: byTeacher.get(t.id)?.note ?? null,
  }));
});

/** Rekap kehadiran ustadz sebulan penuh (bulan diambil dari dateKey). */
export const getStaffAttendanceRecap = cache(async (dateKey: string) => {
  const base = dateKeyToDb(dateKey);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));

  const [teachers, records] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { hasSome: [...STAFF_ROLES] }, status: UserStatus.VERIFIED },
      orderBy: { name: "asc" },
      select: { id: true, name: true, roles: true },
    }),
    prisma.staffAttendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: { teacherId: true, status: true },
    }),
  ]);

  const empty = () => ({ present: 0, late: 0, absent: 0, excused: 0, sick: 0 });
  const byTeacher = new Map(teachers.map((t) => [t.id, empty()]));
  for (const r of records) {
    const c = byTeacher.get(r.teacherId);
    if (!c) continue;
    if (r.status === AttendanceStatus.PRESENT) c.present += 1;
    else if (r.status === AttendanceStatus.LATE) c.late += 1;
    else if (r.status === AttendanceStatus.ABSENT) c.absent += 1;
    else if (r.status === AttendanceStatus.SICK) c.sick += 1;
    else c.excused += 1;
  }

  return teachers.map((t) => ({ id: t.id, name: t.name, roles: t.roles, ...byTeacher.get(t.id)! }));
});

/* -------------------------------------------------------------------------- */
/*                         BKKH (laporan harian ustadz)                       */
/* -------------------------------------------------------------------------- */

/** Laporan kegiatan manual per ustadz pada satu tanggal. */
export const getBkkhDailyReports = cache(async (dateKey: string) => {
  const date = dateKeyToDb(dateKey);
  const reports = await prisma.bkkhReport.findMany({
    where: { date },
    select: {
      id: true,
      teacherId: true,
      activity03000715: true,
      activity07150900: true,
      activity09301200: true,
      activity12301430: true,
      activity15301700: true,
      activity18002100: true,
      updatedAt: true,
    },
  });
  return new Map(reports.map((report) => [report.teacherId, report]));
});

/** Total hari dengan laporan BKKH per ustadz dalam bulan dari dateKey. */
export const getBkkhMonthlyCounts = cache(async (dateKey: string) => {
  const base = dateKeyToDb(dateKey);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const groups = await prisma.bkkhReport.groupBy({
    by: ["teacherId"],
    where: { date: { gte: start, lt: end } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.teacherId, g._count._all]));
});
