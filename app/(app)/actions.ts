"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AdmissionStatus,
  AttendanceStatus,
  CourseStatus,
  EnrollmentStatus,
  NotificationType,
  Prisma,
  Semester,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { requireAnyPermission, requirePermission, requireVerifiedUser, userCan, type AuthUser } from "@/lib/auth";
import { BKKH_TIME_SLOTS, type BkkhActivityField } from "@/lib/bkkh";
import { createStudentNumber } from "@/lib/identifiers";
import { dateKeyToDb, getCurrentPeriod, toDateKey } from "@/lib/lms";
import { notifyUsers } from "@/lib/notifications";
import { ROLE_PRECEDENCE, type Role } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: boolean; message?: string };

const rolesSchema = z
  .array(z.enum(ROLE_PRECEDENCE as [Role, ...Role[]]))
  .min(1, "Pilih minimal satu peran.")
  .transform((roles) => Array.from(new Set(roles)));

function toNullableString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue || null;
}

function canEditAssignedCourse(user: AuthUser, teacherId: string | null) {
  return teacherId === user.id;
}

/**
 * Komponen nilai (bukan nilai santrinya) boleh dikelola pengampu ATAU mudir
 * (assessment.configure) -- sengaja terpisah dari canEditAssignedCourse supaya
 * kewenangan mudir tidak ikut merembet ke absensi atau input nilai santri.
 */
function canManageGradeItems(user: AuthUser, teacherId: string | null) {
  return canEditAssignedCourse(user, teacherId) || userCan(user, "assessment.configure");
}

/** Tanggal dari input form; null bila kosong atau tidak bisa diurai (Invalid Date). */
function parseDateInput(value: FormDataEntryValue | string | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Galat Prisma yang sudah diperkirakan dan punya pesan ramah di UI. */
type PrismaFailure = "duplicate" | "missing";

function knownPrismaFailure(error: unknown): PrismaFailure | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code === "P2002") return "duplicate"; // melanggar unique constraint
  if (error.code === "P2025" || error.code === "P2003") return "missing"; // baris/relasi sudah hilang
  return null;
}

/**
 * Menjalankan satu mutasi Prisma. Galat yang sudah diperkirakan (mis. judul
 * duplikat) dikembalikan sebagai kode supaya pemanggil bisa menampilkan pesan
 * yang manusiawi; galat lain tetap dilempar.
 */
async function runPrismaMutation(mutate: () => Promise<unknown>): Promise<PrismaFailure | null> {
  try {
    await mutate();
    return null;
  } catch (error) {
    const failure = knownPrismaFailure(error);
    if (!failure) throw error;
    return failure;
  }
}

async function isValidTeachingStaff(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] },
      status: UserStatus.VERIFIED,
    },
    select: { id: true },
  });
  return Boolean(user);
}

async function hasAssignedCourses(userId: string) {
  const assignedCourses = await prisma.course.count({
    where: { teacherId: userId, deletedAt: null },
  });
  return assignedCourses > 0;
}

function revalidateCourseAreas(courseId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/mapel");
  revalidatePath("/nilai");
  revalidatePath("/absen");
  revalidatePath("/akademik");
  if (courseId) revalidatePath(`/mapel/${courseId}`);
}

/* ----------------------------- course (mudir) ------------------------------ */

export async function updateCourseAction(formData: FormData) {
  await requirePermission("course.manage");
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "");
  const status = String(formData.get("status") ?? CourseStatus.PUBLISHED) as CourseStatus;

  if (!courseId || !title || !description || !teacherId || !Object.values(CourseStatus).includes(status) || !(await isValidTeachingStaff(teacherId))) {
    redirect(`/mapel/${courseId}?error=invalid`);
  }

  // Mapel yang sudah di-soft-delete tidak boleh menerima perubahan lagi:
  // riwayatnya tetap utuh, tapi barisnya sudah dianggap tidak berlaku.
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, deletedAt: true } });
  if (!course || course.deletedAt) {
    redirect(`/mapel/${courseId}?error=deleted`);
  }

  await prisma.course.update({ where: { id: courseId }, data: { title, description, status, teacherId } });
  revalidateCourseAreas(courseId);
}

/* --------------------------- enrollment (mudir) ----------------------------- */

export async function enrollStudentAction(formData: FormData) {
  await requirePermission("course.manage");
  const courseId = String(formData.get("courseId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");

  if (!courseId || !studentId) {
    redirect(`/mapel/${courseId}?error=enrollment`);
  }

  // Mapel yang sudah di-soft-delete tidak boleh menerima peserta baru.
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, deletedAt: true } });
  if (!course || course.deletedAt) {
    redirect(`/mapel/${courseId}?error=deleted`);
  }

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    update: { status: EnrollmentStatus.ACTIVE },
    create: { studentId, courseId, status: EnrollmentStatus.ACTIVE },
  });

  revalidateCourseAreas(courseId);
}

/* ---------------------- attendance (academic staff) ------------------------ */

export async function createAttendanceSessionAction(formData: FormData) {
  const user = await requirePermission("attendance.record");
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const heldAt = parseDateInput(formData.get("heldAt"));

  if (!courseId || !title) {
    redirect(`/absen?course=${courseId}&error=attendance`);
  }
  if (!heldAt) {
    redirect(`/absen?course=${courseId}&error=date`);
  }

  // deletedAt: null juga menyaring mapel yang sudah di-soft-delete, sehingga
  // sesi absensi baru tidak bisa dibuat untuknya — jatuh ke pesan "forbidden"
  // yang sudah ada, sama seperti mapel yang bukan milik pengampu ini.
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { teacherId: true, deletedAt: true } });
  if (!course || course.deletedAt || !canEditAssignedCourse(user, course.teacherId)) {
    redirect(`/absen?course=${courseId}&error=forbidden`);
  }

  // Sengaja tidak membuat AttendanceRecord di muka: santri tanpa catatan tampil
  // sebagai "belum ditandai", bukan hadir. Catatan dibuat saat sel ditandai.
  const period = getCurrentPeriod(heldAt);
  const failure = await runPrismaMutation(() =>
    prisma.attendanceSession.create({
      data: { courseId, title, heldAt, semester: period.semester, academicYear: period.academicYear },
    }),
  );
  if (failure) {
    redirect(`/absen?course=${courseId}&error=${failure}`);
  }

  revalidateCourseAreas(courseId);
}

export async function updateAttendanceSessionAction(input: {
  sessionId: string;
  title: string;
  heldAt: string;
}): Promise<ActionResult> {
  const user = await requirePermission("attendance.record");
  const title = input.title.trim();
  const heldAt = parseDateInput(input.heldAt);
  if (!input.sessionId || !title) return { ok: false, message: "Judul sesi wajib diisi." };
  if (!heldAt) return { ok: false, message: "Tanggal & waktu sesi tidak valid." };

  const session = await prisma.attendanceSession.findUnique({
    where: { id: input.sessionId },
    select: { courseId: true, course: { select: { teacherId: true } } },
  });
  if (!session) return { ok: false, message: "Sesi absensi tidak ditemukan." };
  if (!canEditAssignedCourse(user, session.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }

  const period = getCurrentPeriod(heldAt);
  const failure = await runPrismaMutation(() =>
    prisma.attendanceSession.update({
      where: { id: input.sessionId },
      data: { title, heldAt, semester: period.semester, academicYear: period.academicYear },
    }),
  );
  if (failure === "duplicate") {
    return { ok: false, message: `Sudah ada sesi absensi berjudul "${title}" di mata pelajaran ini. Pakai judul lain.` };
  }
  if (failure) return { ok: false, message: "Sesi absensi sudah dihapus." };

  revalidateCourseAreas(session.courseId);
  return { ok: true };
}

export async function deleteAttendanceSessionAction(sessionId: string): Promise<ActionResult> {
  const user = await requirePermission("attendance.record");
  if (!sessionId) return { ok: false, message: "Sesi absensi tidak ditemukan." };

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true, course: { select: { teacherId: true } } },
  });
  if (!session) return { ok: false, message: "Sesi absensi tidak ditemukan." };
  if (!canEditAssignedCourse(user, session.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }

  const failure = await runPrismaMutation(() => prisma.attendanceSession.delete({ where: { id: sessionId } }));
  if (failure) return { ok: false, message: "Sesi absensi sudah dihapus." };

  revalidateCourseAreas(session.courseId);
  return { ok: true };
}

/** Batas keterangan absensi; cukup untuk alasan izin/sakit tanpa jadi catatan panjang. */
const MAX_ATTENDANCE_NOTE = 160;

/**
 * Pagar tunggal untuk seluruh mutasi absensi: sesi harus ada dan pemanggilnya
 * harus pengampu mapel tersebut. Mengembalikan courseId supaya pemanggil bisa
 * merevalidasi area yang tepat.
 */
async function assertAttendanceSession(user: AuthUser, sessionId: string) {
  if (!sessionId) return { error: "Sesi absensi tidak ditemukan." as string };
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { courseId: true, course: { select: { teacherId: true } } },
  });
  if (!session) return { error: "Sesi absensi tidak ditemukan." as string };
  if (!canEditAssignedCourse(user, session.course.teacherId)) {
    return { error: "Anda tidak ditugaskan pada mata pelajaran ini." as string };
  }
  return { courseId: session.courseId };
}

export async function setAttendanceStatusAction(input: {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
}): Promise<ActionResult> {
  const user = await requirePermission("attendance.record");
  if (!input.sessionId || !input.studentId || !Object.values(AttendanceStatus).includes(input.status)) {
    return { ok: false, message: "Data absensi tidak valid." };
  }
  const note = String(input.note ?? "").trim();
  if (note.length > MAX_ATTENDANCE_NOTE) {
    return { ok: false, message: `Keterangan maksimal ${MAX_ATTENDANCE_NOTE} karakter.` };
  }
  const session = await prisma.attendanceSession.findUnique({
    where: { id: input.sessionId },
    select: {
      courseId: true,
      course: {
        select: {
          teacherId: true,
          enrollments: {
            where: { studentId: input.studentId, status: EnrollmentStatus.ACTIVE },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!session || !canEditAssignedCourse(user, session.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }
  if (session.course.enrollments.length === 0) {
    return { ok: false, message: "Santri tidak terdaftar pada mata pelajaran ini." };
  }
  const failure = await runPrismaMutation(() =>
    prisma.attendanceRecord.upsert({
      where: { attendanceSessionId_studentId: { attendanceSessionId: input.sessionId, studentId: input.studentId } },
      update: { status: input.status, note: note || null },
      create: { attendanceSessionId: input.sessionId, studentId: input.studentId, status: input.status, note: note || null },
    }),
  );
  if (failure) return { ok: false, message: "Sesi absensi atau santri sudah tidak ada. Muat ulang halaman." };
  revalidatePath("/absen");
  return { ok: true };
}

/** Batalkan tanda kehadiran satu santri; barisnya dihapus sehingga kembali "belum ditandai". */
export async function clearAttendanceStatusAction(input: { sessionId: string; studentId: string }): Promise<ActionResult> {
  const user = await requirePermission("attendance.record");
  if (!input.studentId) return { ok: false, message: "Data absensi tidak valid." };
  const guard = await assertAttendanceSession(user, input.sessionId);
  if (guard.error) return { ok: false, message: guard.error };

  // deleteMany, bukan delete: menghapus tanda yang memang belum ada bukan galat.
  await prisma.attendanceRecord.deleteMany({
    where: { attendanceSessionId: input.sessionId, studentId: input.studentId },
  });
  revalidatePath("/absen");
  return { ok: true };
}

/**
 * Tandai banyak santri sekaligus pada satu sesi. scope "unmarked" hanya mengisi
 * santri yang belum punya catatan, jadi koreksi manual sebelumnya tidak tertimpa.
 */
export async function bulkMarkAttendanceAction(input: {
  sessionId: string;
  status: AttendanceStatus;
  scope: "all" | "unmarked";
}): Promise<ActionResult> {
  const user = await requirePermission("attendance.record");
  if (!Object.values(AttendanceStatus).includes(input.status)) {
    return { ok: false, message: "Status absensi tidak valid." };
  }
  const guard = await assertAttendanceSession(user, input.sessionId);
  if (guard.error) return { ok: false, message: guard.error };

  // Catatan kehadiran tidak dibuat di muka, jadi tandai-massal harus membuat
  // baris yang belum ada (updateMany akan diam-diam tidak mengubah apa pun).
  const [enrollments, existing] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: guard.courseId, status: EnrollmentStatus.ACTIVE },
      select: { studentId: true },
    }),
    prisma.attendanceRecord.findMany({ where: { attendanceSessionId: input.sessionId }, select: { studentId: true } }),
  ]);
  if (enrollments.length === 0) {
    return { ok: false, message: "Belum ada santri terdaftar pada mata pelajaran ini." };
  }
  const marked = new Set(existing.map((r) => r.studentId));
  const targets = input.scope === "all" ? enrollments : enrollments.filter((e) => !marked.has(e.studentId));
  if (targets.length === 0) {
    return { ok: false, message: "Semua santri pada sesi ini sudah ditandai." };
  }

  const failure = await runPrismaMutation(() =>
    prisma.$transaction(
      targets.map((e) =>
        prisma.attendanceRecord.upsert({
          where: { attendanceSessionId_studentId: { attendanceSessionId: input.sessionId, studentId: e.studentId } },
          update: { status: input.status },
          create: { attendanceSessionId: input.sessionId, studentId: e.studentId, status: input.status },
        }),
      ),
    ),
  );
  if (failure) return { ok: false, message: "Sesi absensi sudah dihapus. Muat ulang halaman." };
  revalidatePath("/absen");
  return { ok: true };
}

/* ------------------------- grades (academic staff) ------------------------- */

/**
 * Batas atas skala komponen nilai. Kolom maxScore bertipe int4 di Postgres,
 * jadi angka raksasa (mis. 3.000.000.000) gagal di level basis data dengan
 * galat yang tidak punya pesan ramah. Batas ini masih jauh lebih longgar dari
 * skala yang wajar dipakai (100, 200, 1000).
 */
const MAX_GRADE_MAX_SCORE = 1000;

type InsertGradeItemInput = {
  courseId: string;
  title: string;
  description: string | null;
  maxScore: number;
  weight: number;
  dueAt: Date | null;
  semester: Semester;
  academicYear: string;
};
type InsertGradeItemError = "grade" | "maxscore" | "forbidden" | PrismaFailure;

/**
 * Logika inti pembuatan komponen nilai, dipakai dua jalur pemanggilan: form
 * biasa (createGradeItemAction, /nilai, redirect+query error) dan action
 * typed (addGradeItemAction, tab Bobot di /akademik, ActionResult+toast).
 */
async function insertGradeItem(
  user: AuthUser,
  input: InsertGradeItemInput,
): Promise<{ ok: true } | { ok: false; error: InsertGradeItemError }> {
  if (
    !input.courseId ||
    !input.title ||
    !Number.isInteger(input.maxScore) ||
    input.maxScore < 1 ||
    !Number.isInteger(input.weight) ||
    input.weight < 0 ||
    input.weight > 100
  ) {
    return { ok: false, error: "grade" };
  }
  if (input.maxScore > MAX_GRADE_MAX_SCORE) return { ok: false, error: "maxscore" };

  // deletedAt: null juga menyaring mapel yang sudah di-soft-delete, sehingga
  // komponen nilai baru tidak bisa dibuat untuknya — jatuh ke pesan "forbidden"
  // yang sudah ada, sama seperti mapel yang bukan milik pengampu/mudir ini.
  const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { teacherId: true, deletedAt: true } });
  if (!course || course.deletedAt || !canManageGradeItems(user, course.teacherId)) {
    return { ok: false, error: "forbidden" };
  }

  const failure = await runPrismaMutation(() =>
    prisma.gradeItem.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        maxScore: input.maxScore,
        weight: input.weight,
        dueAt: input.dueAt,
        semester: input.semester,
        academicYear: input.academicYear,
      },
    }),
  );
  if (failure) return { ok: false, error: failure };

  revalidateCourseAreas(input.courseId);
  return { ok: true };
}

export async function createGradeItemAction(formData: FormData) {
  const user = await requireAnyPermission(["grade.manage", "assessment.configure"]);
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = toNullableString(formData.get("description"));
  const maxScore = Number(formData.get("maxScore") ?? 100);
  const weight = Number(formData.get("weight") ?? 0);
  const dueValue = String(formData.get("dueAt") ?? "").trim();
  const dueAt = parseDateInput(dueValue);
  if (dueValue && !dueAt) {
    redirect(`/nilai?course=${courseId}&error=date`);
  }

  const period = getCurrentPeriod();
  const result = await insertGradeItem(user, {
    courseId,
    title,
    description,
    maxScore,
    weight,
    dueAt,
    semester: period.semester,
    academicYear: period.academicYear,
  });
  if (!result.ok) {
    redirect(`/nilai?course=${courseId}&error=${result.error}`);
  }
}

const ADD_GRADE_ITEM_ERROR: Record<InsertGradeItemError, string> = {
  grade: "Nama, nilai maksimal (bilangan bulat ≥1), dan bobot (0-100) wajib diisi dengan benar.",
  maxscore: `Nilai maksimal terlalu besar. Gunakan bilangan bulat 1-${MAX_GRADE_MAX_SCORE}.`,
  forbidden: "Anda tidak berwenang menambah komponen pada mata pelajaran ini.",
  duplicate: "Sudah ada komponen nilai dengan judul itu di mata pelajaran ini. Gunakan judul lain.",
  missing: "Mata pelajaran sudah tidak tersedia. Muat ulang halaman.",
};

/**
 * Sama seperti createGradeItemAction, untuk UI berbasis ActionResult (tab
 * Bobot di /akademik). Periode diambil dari yang sedang dipilih di tab itu,
 * BUKAN dari getCurrentPeriod() -- tab Bobot punya pemilih periode sendiri
 * sehingga bisa dipakai untuk semester selain semester berjalan.
 */
export async function addGradeItemAction(input: {
  courseId: string;
  title: string;
  maxScore: number;
  weight: number;
  dueAt: string;
  semester: Semester;
  academicYear: string;
}): Promise<ActionResult> {
  const user = await requireAnyPermission(["grade.manage", "assessment.configure"]);
  const title = input.title.trim();
  const dueAt = parseDateInput(input.dueAt);
  if (input.dueAt.trim() && !dueAt) return { ok: false, message: "Tenggat tidak valid." };

  const result = await insertGradeItem(user, {
    courseId: input.courseId,
    title,
    description: null,
    maxScore: input.maxScore,
    weight: input.weight,
    dueAt,
    semester: input.semester,
    academicYear: input.academicYear,
  });
  if (!result.ok) return { ok: false, message: ADD_GRADE_ITEM_ERROR[result.error] };
  return { ok: true };
}

/**
 * Menskalakan ulang nilai tersimpan ke skala baru. Nilai disimpan pada skala
 * komponennya, jadi mengubah maxScore tanpa ini membuat nilai lama terbaca
 * salah (mis. 85 pada skala 100 akan terbaca 850% pada skala 10).
 * Pembulatan memang mengurangi presisi saat skala diperkecil.
 * null = skala lama tidak sah, baris dilewati (bukan dinolkan).
 */
function rescaleScore(score: number, oldMax: number, newMax: number): number | null {
  if (!(oldMax > 0)) return null;
  return Math.max(0, Math.min(newMax, Math.round((score / oldMax) * newMax)));
}

export async function updateGradeItemAction(input: {
  gradeItemId: string;
  title: string;
  maxScore: number;
  weight: number;
  dueAt: string;
}): Promise<ActionResult & { rescaled?: number }> {
  const user = await requireAnyPermission(["grade.manage", "assessment.configure"]);
  const title = input.title.trim();
  const dueAt = parseDateInput(input.dueAt);
  if (!input.gradeItemId || !title) return { ok: false, message: "Nama komponen wajib diisi." };
  if (!Number.isInteger(input.maxScore) || input.maxScore < 1 || input.maxScore > MAX_GRADE_MAX_SCORE) {
    return { ok: false, message: `Nilai maksimal harus bilangan bulat 1-${MAX_GRADE_MAX_SCORE}.` };
  }
  if (!Number.isInteger(input.weight) || input.weight < 0 || input.weight > 100) {
    return { ok: false, message: "Bobot harus bilangan bulat 0-100 persen." };
  }
  if (input.dueAt.trim() && !dueAt) return { ok: false, message: "Tenggat tidak valid." };

  const item = await prisma.gradeItem.findUnique({
    where: { id: input.gradeItemId },
    // maxScore lama sengaja tidak dibaca di sini: nilainya diambil ulang di
    // dalam transaksi di bawah, saat barisnya sudah terkunci.
    select: { courseId: true, course: { select: { teacherId: true } } },
  });
  if (!item) return { ok: false, message: "Komponen nilai tidak ditemukan." };
  if (!canManageGradeItems(user, item.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }

  // Nilai lama harus dibaca DAN dipindah skala di dalam transaksi yang sama
  // dengan perubahan maxScore: kalau dibaca di luar, nilai yang masuk di sela
  // pembacaan dan transaksi tidak ikut diskalakan dan tertinggal pada skala
  // lama. Baris gradeItem dikunci lebih dulu (FOR UPDATE) dan saveGradeAction
  // menahan FOR SHARE pada baris yang sama sebelum menulis nilai, jadi selama
  // transaksi ini berjalan tidak ada nilai baru yang bisa masuk pada skala lama.
  // Urutan kunci sama di kedua action (gradeItem dulu, baru gradeRecord) supaya
  // tidak saling deadlock.
  let rescaled = 0;
  const failure = await runPrismaMutation(() =>
    prisma.$transaction(async (tx) => {
      rescaled = 0;
      const [locked] = await tx.$queryRaw<{ maxScore: number }[]>`
        SELECT "maxScore" FROM "GradeItem" WHERE "id" = ${input.gradeItemId} FOR UPDATE
      `;
      await tx.gradeItem.update({
        where: { id: input.gradeItemId },
        data: { title, maxScore: input.maxScore, weight: input.weight, dueAt },
      });
      // locked pasti ada di sini: kalau komponennya sudah dihapus, update di atas
      // sudah melempar P2025 lebih dulu.
      if (!locked || locked.maxScore === input.maxScore) return;

      const records = await tx.gradeRecord.findMany({
        where: { gradeItemId: input.gradeItemId },
        select: { id: true, score: true },
      });
      // Dikelompokkan per nilai baru dan ditandai lewat id, bukan lewat nilai lama,
      // agar baris yang sudah diskalakan tidak ikut tersapu update berikutnya.
      const idsByNewScore = new Map<number, string[]>();
      for (const record of records) {
        const next = rescaleScore(record.score, locked.maxScore, input.maxScore);
        if (next === null || next === record.score) continue;
        const ids = idsByNewScore.get(next) ?? [];
        ids.push(record.id);
        idsByNewScore.set(next, ids);
        rescaled += 1;
      }
      for (const [score, ids] of idsByNewScore) {
        await tx.gradeRecord.updateMany({ where: { id: { in: ids } }, data: { score } });
      }
    }),
  );
  if (failure === "duplicate") {
    return { ok: false, message: `Sudah ada komponen nilai berjudul "${title}" di mata pelajaran ini. Pakai judul lain.` };
  }
  if (failure) return { ok: false, message: "Komponen nilai sudah dihapus." };

  revalidateCourseAreas(item.courseId);
  return { ok: true, rescaled };
}

export async function deleteGradeItemAction(gradeItemId: string): Promise<ActionResult> {
  const user = await requireAnyPermission(["grade.manage", "assessment.configure"]);
  if (!gradeItemId) return { ok: false, message: "Komponen nilai tidak ditemukan." };

  const item = await prisma.gradeItem.findUnique({
    where: { id: gradeItemId },
    select: { courseId: true, course: { select: { teacherId: true } } },
  });
  if (!item) return { ok: false, message: "Komponen nilai tidak ditemukan." };
  if (!canManageGradeItems(user, item.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }

  const failure = await runPrismaMutation(() => prisma.gradeItem.delete({ where: { id: gradeItemId } }));
  if (failure) return { ok: false, message: "Komponen nilai sudah dihapus." };

  revalidateCourseAreas(item.courseId);
  return { ok: true };
}

export async function saveGradeAction(input: {
  gradeItemId: string;
  studentId: string;
  value: number; // 0-100 display value
}): Promise<ActionResult> {
  const user = await requirePermission("grade.manage");
  const item = await prisma.gradeItem.findUnique({
    where: { id: input.gradeItemId },
    select: {
      maxScore: true,
      course: {
        select: {
          teacherId: true,
          enrollments: {
            where: { studentId: input.studentId, status: EnrollmentStatus.ACTIVE },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!item || !input.studentId || !Number.isFinite(input.value)) {
    return { ok: false, message: "Data nilai tidak valid." };
  }
  if (!canEditAssignedCourse(user, item.course.teacherId)) {
    return { ok: false, message: "Anda tidak ditugaskan pada mata pelajaran ini." };
  }
  if (item.course.enrollments.length === 0) {
    return { ok: false, message: "Santri tidak terdaftar pada mata pelajaran ini." };
  }
  const clamped = Math.max(0, Math.min(100, Math.round(input.value)));
  // maxScore dibaca ulang di dalam transaksi sambil mengunci baris komponennya
  // (FOR SHARE). updateGradeItemAction mengunci baris yang sama secara eksklusif
  // saat menskalakan ulang, jadi nilai ini tidak akan pernah tersimpan pada
  // skala lama yang sudah keburu diganti.
  const failure = await runPrismaMutation(() =>
    prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ maxScore: number }[]>`
        SELECT "maxScore" FROM "GradeItem" WHERE "id" = ${input.gradeItemId} FOR SHARE
      `;
      // Komponen sudah dihapus: upsert di bawah melempar P2003 dan dipetakan ke
      // pesan "sudah tidak ada" seperti sebelumnya.
      const score = Math.round((clamped / 100) * (locked?.maxScore ?? item.maxScore));
      await tx.gradeRecord.upsert({
        where: { gradeItemId_studentId: { gradeItemId: input.gradeItemId, studentId: input.studentId } },
        update: { score },
        create: { gradeItemId: input.gradeItemId, studentId: input.studentId, score },
      });
    }),
  );
  if (failure) return { ok: false, message: "Komponen nilai atau santri sudah tidak ada. Muat ulang halaman." };
  revalidatePath("/nilai");
  return { ok: true };
}

/* ----------------------- schedule (mudir) ----------------------------------- */

const SCHEDULE_DAY_LABELS = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

export async function createScheduleSlotAction(formData: FormData) {
  const actor = await requirePermission("course.manage");
  const courseId = String(formData.get("courseId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek") ?? -1);
  const startTime = String(formData.get("startTime") ?? "").trim().replace(".", ":");
  const endTime = String(formData.get("endTime") ?? "").trim().replace(".", ":");
  const room = String(formData.get("room") ?? "").trim();
  const level = String(formData.get("level") ?? "SMP");
  const returnTo = `/akademik?tab=jadwal&level=${["SD", "SMP", "SMA"].includes(level) ? level : "SMP"}`;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    !courseId ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !validTime.test(startTime) ||
    !validTime.test(endTime) ||
    endTime <= startTime ||
    !room ||
    room.length > 80
  ) {
    redirect(`${returnTo}&error=invalid`);
  }

  // Mapel yang sudah dihapus (soft-delete) atau tidak ada tidak boleh menerima
  // slot jadwal baru.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      deletedAt: true,
      teacherId: true,
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE },
        select: { student: { select: { parentId: true } } },
      },
    },
  });
  if (!course || course.deletedAt) {
    redirect(`${returnTo}&error=invalid`);
  }

  const conflict = await prisma.scheduleSlot.findFirst({
    where: {
      dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [
        { room: { equals: room, mode: "insensitive" } },
        ...(course.teacherId ? [{ course: { teacherId: course.teacherId } }] : []),
      ],
    },
    select: { id: true },
  });
  if (conflict) redirect(`${returnTo}&error=conflict`);

  await prisma.scheduleSlot.create({ data: { courseId, dayOfWeek, startTime, endTime, room } });
  await notifyUsers(
    [course.teacherId, ...course.enrollments.map((enrollment) => enrollment.student.parentId)].filter(
      (id): id is string => id !== null,
    ),
    {
      type: NotificationType.SCHEDULE,
      title: "Jadwal pelajaran ditambahkan",
      message: `${course.title} dijadwalkan pada ${SCHEDULE_DAY_LABELS[dayOfWeek]}, ${startTime}-${endTime} di ${room}.`,
      href: "/jadwal",
    },
    actor.id,
  );
  revalidatePath("/jadwal");
  revalidatePath("/akademik");
  revalidatePath("/dashboard");
}

export async function deleteScheduleSlotAction(id: string): Promise<ActionResult> {
  const actor = await requirePermission("course.manage");
  if (!id) return { ok: false, message: "Jadwal tidak ditemukan." };
  const slot = await prisma.scheduleSlot.findUnique({
    where: { id },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      course: {
        select: {
          title: true,
          teacherId: true,
          enrollments: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { student: { select: { parentId: true } } },
          },
        },
      },
    },
  });
  if (!slot) return { ok: false, message: "Jadwal tidak ditemukan." };

  await prisma.scheduleSlot.delete({ where: { id } });
  await notifyUsers(
    [slot.course.teacherId, ...slot.course.enrollments.map((enrollment) => enrollment.student.parentId)].filter(
      (recipientId): recipientId is string => recipientId !== null,
    ),
    {
      type: NotificationType.SCHEDULE,
      title: "Jadwal pelajaran dihapus",
      message: `Jadwal ${slot.course.title} pada ${SCHEDULE_DAY_LABELS[slot.dayOfWeek]}, ${slot.startTime}-${slot.endTime} di ${slot.room} telah dihapus.`,
      href: "/jadwal",
    },
    actor.id,
  );
  revalidatePath("/jadwal");
  revalidatePath("/akademik");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ----------------------------- profile (self) ------------------------------ */

export async function updateProfileAction(input: { name: string }): Promise<ActionResult> {
  const user = await requireVerifiedUser();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Nama wajib diisi." };

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/pengaturan");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* --------------------------- user management (admin) ----------------------- */

export async function setUserStatusAction(userId: string, status: UserStatus): Promise<ActionResult> {
  const admin = await requirePermission("user.manage");
  if (!userId || !Object.values(UserStatus).includes(status)) {
    return { ok: false, message: "Status tidak valid." };
  }
  if (status !== UserStatus.VERIFIED && (await hasAssignedCourses(userId))) {
    return { ok: false, message: "Alihkan seluruh mata pelajaran yang diampu sebelum mengubah status akun." };
  }
  // Jalur kedua menuju lockout yang sama seperti di updateUserAction: menonaktifkan
  // admin aktif terakhir membuat hak kelola pengguna tidak bisa dipulihkan lagi.
  if (status !== UserStatus.VERIFIED) {
    if (userId === admin.id) {
      return { ok: false, message: "Tidak bisa menonaktifkan akun sendiri." };
    }
    const otherActiveAdmins = await prisma.user.count({
      where: { id: { not: userId }, roles: { has: UserRole.ADMIN }, status: UserStatus.VERIFIED },
    });
    if (otherActiveAdmins === 0) {
      return { ok: false, message: "Sisakan minimal satu akun Administrasi aktif." };
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      verifiedAt: status === UserStatus.VERIFIED ? new Date() : null,
      verifiedById: status === UserStatus.VERIFIED ? admin.id : null,
    },
  });
  revalidatePath("/pengguna");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createUserAction(input: {
  name: string;
  email: string;
  roles: Role[];
}): Promise<ActionResult> {
  await requirePermission("user.manage");
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const rolesResult = rolesSchema.safeParse(input.roles);
  if (!name || !email || !rolesResult.success) {
    return { ok: false, message: "Nama, email, dan peran wajib diisi." };
  }
  const roles = rolesResult.data as UserRole[];

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, message: "Email sudah dipakai akun lain." };

  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles,
      status: UserStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  revalidatePath("/pengguna");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateUserAction(input: {
  userId: string;
  name: string;
  roles: Role[];
  status: UserStatus;
}): Promise<ActionResult> {
  const actor = await requirePermission("user.manage");
  const name = input.name.trim();
  const rolesResult = rolesSchema.safeParse(input.roles);
  if (!input.userId || !name || !rolesResult.success || !Object.values(UserStatus).includes(input.status)) {
    return { ok: false, message: "Data pengguna tidak valid." };
  }
  const roles = rolesResult.data as UserRole[];

  // Tidak ada peran super admin terpisah, jadi hak kelola pengguna hanya bisa
  // dipulihkan dari dalam aplikasi selama masih ada admin aktif. Dua pagar di
  // bawah mencegah admin terakhir mengunci semua orang di luar sistem.
  const staysActiveAdmin = roles.includes(UserRole.ADMIN) && input.status === UserStatus.VERIFIED;
  if (!staysActiveAdmin) {
    if (input.userId === actor.id) {
      return { ok: false, message: "Tidak bisa mencabut peran Administrasi dari akun sendiri." };
    }
    const otherActiveAdmins = await prisma.user.count({
      where: { id: { not: input.userId }, roles: { has: UserRole.ADMIN }, status: UserStatus.VERIFIED },
    });
    if (otherActiveAdmins === 0) {
      return { ok: false, message: "Sisakan minimal satu akun Administrasi aktif." };
    }
  }

  const remainsVerifiedTeachingStaff =
    input.status === UserStatus.VERIFIED &&
    (roles.includes(UserRole.TEACHER) || roles.includes(UserRole.HOMEROOM));
  if (!remainsVerifiedTeachingStaff && (await hasAssignedCourses(input.userId))) {
    return { ok: false, message: "Alihkan seluruh mata pelajaran yang diampu sebelum mengubah role atau status akun." };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { name, roles, status: input.status },
  });
  revalidatePath("/pengguna");
  return { ok: true };
}

/* ----------------------- admissions review (admin) ------------------------- */

export async function reviewAdmissionAction(input: {
  admissionId: string;
  decision: "ACCEPTED" | "REJECTED";
  reviewNote?: string;
}): Promise<ActionResult> {
  const admin = await requirePermission("admission.review");
  const reviewNote = input.reviewNote?.trim() || null;
  if (reviewNote && reviewNote.length > 1000) {
    return { ok: false, message: "Catatan keputusan maksimal 1.000 karakter." };
  }
  const adm = await prisma.admission.findUnique({ where: { id: input.admissionId } });
  if (!adm) return { ok: false, message: "Pendaftaran tidak ditemukan." };
  if (adm.status !== AdmissionStatus.PENDING) return { ok: false, message: "Pendaftaran sudah diproses." };

  if (input.decision === "REJECTED") {
    let recipientId = adm.submitterId;
    if (!recipientId) {
      const parent = await prisma.user.findUnique({
        where: { email: adm.parentEmail.toLowerCase().trim() },
        select: { id: true, roles: true },
      });
      if (parent?.roles.includes(UserRole.PARENT)) recipientId = parent.id;
    }

    await prisma.admission.update({
      where: { id: adm.id },
      data: {
        status: AdmissionStatus.REJECTED,
        reviewNote,
        reviewedAt: new Date(),
        reviewedById: admin.id,
        submitterId: recipientId,
      },
    });
    revalidatePath("/penerimaan");
    revalidatePath("/dashboard");
    revalidatePath("/anak");
    const notificationCreated = recipientId
      ? await notifyUsers([recipientId], {
          type: NotificationType.ADMISSION,
          title: "Pendaftaran ditolak",
          message: `Pendaftaran ${adm.childName} (${adm.registrationCode}) belum dapat diterima. Buka untuk melihat catatan administrasi.`,
          href: "/anak#status-pendaftaran",
        })
      : false;
    return {
      ok: true,
      message: notificationCreated
        ? `${adm.childName} ditolak. Notifikasi aplikasi sudah dibuat.`
        : `${adm.childName} ditolak. Pendaftaran ini belum terhubung ke akun wali.`,
    };
  }

  const parentEmail = adm.parentEmail.toLowerCase().trim();

  let parent = adm.submitterId
    ? await prisma.user.findUnique({ where: { id: adm.submitterId }, select: { id: true, roles: true } })
    : await prisma.user.findUnique({ where: { email: parentEmail }, select: { id: true, roles: true } });
  if (!parent) {
    const passwordHash = await bcrypt.hash("password123", 12);
    parent = await prisma.user.create({
      data: {
        name: adm.parentName,
        email: parentEmail,
        phone: adm.parentPhone,
        passwordHash,
        roles: [UserRole.PARENT],
        status: UserStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: admin.id,
      },
      select: { id: true, roles: true },
    });
  } else {
    if (!parent.roles.includes(UserRole.PARENT)) {
      return { ok: false, message: "Email sudah dipakai akun non-wali. Gunakan email wali yang berbeda." };
    }
    await prisma.user.update({
      where: { id: parent.id },
      data: { name: adm.parentName, phone: adm.parentPhone, status: UserStatus.VERIFIED, verifiedAt: new Date(), verifiedById: admin.id },
    });
  }

  const studentNumber = createStudentNumber(adm.level);
  const student = await prisma.studentProfile.create({
    data: {
      name: adm.childName,
      level: adm.level,
      studentNumber,
      className: `${adm.level}-1`,
      parentId: parent.id,
      address: adm.address,
    },
    select: { id: true, studentNumber: true },
  });

  await prisma.admission.update({
    where: { id: adm.id },
    data: {
      status: AdmissionStatus.ACCEPTED,
      reviewNote,
      reviewedAt: new Date(),
      reviewedById: admin.id,
      createdParentId: parent.id,
      createdStudentId: student.id,
      submitterId: parent.id,
    },
  });

  revalidatePath("/penerimaan");
  revalidatePath("/pengguna");
  revalidatePath("/anak");
  revalidatePath("/dashboard");
  const notificationCreated = await notifyUsers([parent.id], {
    type: NotificationType.ADMISSION,
    title: "Pendaftaran diterima",
    message: `Pendaftaran ${adm.childName} (${adm.registrationCode}) diterima dengan NIS ${student.studentNumber}.`,
    href: "/anak#status-pendaftaran",
  });
  return {
    ok: true,
    message: notificationCreated
      ? `${adm.childName} diterima dengan NIS ${student.studentNumber}. Notifikasi aplikasi sudah dibuat.`
      : `${adm.childName} diterima dengan NIS ${student.studentNumber}.`,
  };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requirePermission("user.manage");
  if (!userId) return { ok: false, message: "Pengguna tidak ditemukan." };
  if (userId === admin.id) return { ok: false, message: "Tidak bisa menghapus akun sendiri." };
  if (await hasAssignedCourses(userId)) {
    return { ok: false, message: "Alihkan seluruh mata pelajaran yang diampu sebelum menghapus akun." };
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/pengguna");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* --------------------------- absensi ustadz -------------------------------- */

export async function saveStaffAttendanceAction(formData: FormData) {
  const user = await requireVerifiedUser();
  const teacherId = String(formData.get("teacherId") ?? "");
  const dateKey = String(formData.get("date") ?? "");
  const statusRaw = String(formData.get("status") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Object.values(AttendanceStatus).includes(statusRaw as AttendanceStatus)) {
    redirect("/absen-ustadz?error=invalid");
  }

  const isOwnRow = teacherId === user.id;
  const canRecordSelf = isOwnRow && dateKey === toDateKey(new Date()) && userCan(user, "staff_attendance.self");
  const canRecordOthers = userCan(user, "staff_attendance.record");
  if (!canRecordOthers && !canRecordSelf) {
    redirect("/absen-ustadz?error=forbidden");
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] } },
    select: { id: true },
  });
  if (!teacher) redirect("/absen-ustadz?error=invalid");

  const status = statusRaw as AttendanceStatus;
  const date = dateKeyToDb(dateKey);
  await prisma.staffAttendance.upsert({
    where: { teacherId_date: { teacherId, date } },
    update: { status, recordedById: user.id },
    create: { teacherId, date, status, recordedById: user.id },
  });

  revalidatePath("/absen-ustadz");
  redirect(`/absen-ustadz?tanggal=${dateKey}`);
}

/* ------------------------- BKKH (laporan harian) ---------------------------- */

export async function saveBkkhReportAction(formData: FormData) {
  const user = await requirePermission("staff_attendance.self");
  const teacherId = String(formData.get("teacherId") ?? "");
  const dateKey = String(formData.get("date") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    redirect("/absen-ustadz?error=invalid");
  }

  const isSelfToday = teacherId === user.id && dateKey === toDateKey(new Date());
  if (!isSelfToday) {
    redirect("/absen-ustadz?error=forbidden");
  }

  const activities = Object.fromEntries(
    BKKH_TIME_SLOTS.map(({ field }) => [field, String(formData.get(field) ?? "").trim() || null]),
  ) as Record<BkkhActivityField, string | null>;

  if (Object.values(activities).every((value) => value === null)) {
    redirect(`/absen-ustadz?tanggal=${dateKey}&error=activity`);
  }
  if (Object.values(activities).some((value) => (value?.length ?? 0) > 2000)) {
    redirect(`/absen-ustadz?tanggal=${dateKey}&error=invalid`);
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] } },
    select: { id: true },
  });
  if (!teacher) redirect("/absen-ustadz?error=invalid");

  const date = dateKeyToDb(dateKey);
  await prisma.bkkhReport.upsert({
    where: { teacherId_date: { teacherId, date } },
    update: activities,
    create: { teacherId, date, ...activities },
  });

  revalidatePath("/absen-ustadz");
  redirect(`/absen-ustadz?tanggal=${dateKey}&success=bkkh`);
}
