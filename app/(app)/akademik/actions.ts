"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssessmentGroupKind, EducationLevel, EnrollmentStatus, Semester, UserRole, UserStatus } from "@/generated/prisma/client";
import { requirePermission, userCan, type AuthUser } from "@/lib/auth";
import { formatPeriod } from "@/lib/lms";
import { prisma } from "@/lib/prisma";
import { REPORT_SIGNATORY_KEYS, type ReportSignatories } from "@/lib/rapor";

type ActionResult = { ok: boolean; message?: string };

const ACADEMIC_YEAR_RE = /^\d{4}\/\d{4}$/;

function revalidateAkademik() {
  revalidatePath("/akademik");
  revalidatePath("/dashboard");
  revalidatePath("/rapor");
  revalidatePath("/nilai");
  revalidatePath("/jadwal");
  revalidatePath("/absen");
  revalidatePath("/anak");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function isVerifiedHomeroom(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, roles: { has: UserRole.HOMEROOM }, status: UserStatus.VERIFIED },
    select: { id: true },
  });
  return Boolean(user);
}

async function isVerifiedTeachingStaff(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] }, status: UserStatus.VERIFIED },
    select: { id: true },
  });
  return Boolean(user);
}

/* -------------------------------------------------------------------------- */
/*                                    kelas                                   */
/* -------------------------------------------------------------------------- */

const createClassSchema = z.object({
  name: z.string().trim().min(1, "Nama kelas wajib diisi.").max(40),
  level: z.enum(EducationLevel),
  academicYear: z.string().regex(ACADEMIC_YEAR_RE, "Format tahun ajaran harus mis. 2026/2027."),
});

export async function createClassAction(input: {
  name: string;
  level: EducationLevel;
  academicYear: string;
}): Promise<ActionResult> {
  await requirePermission("class.manage");
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data kelas tidak valid." };
  }
  const { name, level, academicYear } = parsed.data;

  const existing = await prisma.classRoom.findUnique({
    where: { name_academicYear: { name, academicYear } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: `Kelas ${name} pada tahun ajaran ${academicYear} sudah ada.` };
  }

  await prisma.classRoom.create({ data: { name, level, academicYear } });
  revalidateAkademik();
  return { ok: true };
}

export async function updateClassAction(input: {
  classId: string;
  name: string;
  level: EducationLevel;
  academicYear: string;
}): Promise<ActionResult> {
  await requirePermission("class.manage");
  if (!input.classId) return { ok: false, message: "Kelas tidak ditemukan." };
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data kelas tidak valid." };
  }
  const { name, level, academicYear } = parsed.data;

  const classRoom = await prisma.classRoom.findUnique({ where: { id: input.classId }, select: { id: true, name: true } });
  if (!classRoom) return { ok: false, message: "Kelas tidak ditemukan." };

  const clash = await prisma.classRoom.findUnique({
    where: { name_academicYear: { name, academicYear } },
    select: { id: true },
  });
  if (clash && clash.id !== input.classId) {
    return { ok: false, message: `Kelas ${name} pada tahun ajaran ${academicYear} sudah ada.` };
  }

  await prisma.classRoom.update({ where: { id: input.classId }, data: { name, level, academicYear } });
  // StudentProfile.className adalah denormalisasi dari nama kelas (lihat
  // placeStudentAction) — kalau nama kelas berganti, santri yang sudah
  // ditempatkan di kelas ini harus ikut disinkronkan, bukan tertinggal
  // memakai nama lama.
  if (name !== classRoom.name) {
    await prisma.studentProfile.updateMany({ where: { classRoomId: input.classId }, data: { className: name } });
  }
  revalidateAkademik();
  return { ok: true };
}

/**
 * Kelas hanya boleh dihapus jika sudah kosong dari santri maupun mapel, supaya
 * penghapusan tidak diam-diam melepas relasi penting (santri jadi tak berkelas
 * tanpa disadari, mapel kehilangan penempatan kelasnya).
 */
export async function deleteClassAction(classId: string): Promise<ActionResult> {
  await requirePermission("class.manage");
  if (!classId) return { ok: false, message: "Kelas tidak ditemukan." };
  const classRoom = await prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true, name: true } });
  if (!classRoom) return { ok: false, message: "Kelas tidak ditemukan." };

  const [studentCount, courseCount] = await Promise.all([
    prisma.studentProfile.count({ where: { classRoomId: classId } }),
    prisma.course.count({ where: { classRoomId: classId, deletedAt: null } }),
  ]);
  if (studentCount > 0 || courseCount > 0) {
    const parts: string[] = [];
    if (studentCount > 0) parts.push(`${studentCount} santri`);
    if (courseCount > 0) parts.push(`${courseCount} mata pelajaran`);
    return {
      ok: false,
      message: `Tidak bisa dihapus: kelas ${classRoom.name} masih memiliki ${parts.join(
        " dan ",
      )}. Keluarkan/pindahkan terlebih dahulu sebelum menghapus kelas.`,
    };
  }

  await prisma.classRoom.delete({ where: { id: classId } });
  revalidateAkademik();
  return { ok: true };
}

export async function assignHomeroomAction(input: { classId: string; teacherId: string | null }): Promise<ActionResult> {
  await requirePermission("class.manage");
  if (!input.classId) return { ok: false, message: "Kelas tidak ditemukan." };

  const classRoom = await prisma.classRoom.findUnique({ where: { id: input.classId }, select: { id: true, academicYear: true } });
  if (!classRoom) return { ok: false, message: "Kelas tidak ditemukan." };

  if (input.teacherId) {
    if (!(await isVerifiedHomeroom(input.teacherId))) {
      return { ok: false, message: "Pilih wali kelas dari akun ustadz berperan Wali Kelas yang sudah terverifikasi." };
    }
    const alreadyAssigned = await prisma.classRoom.findFirst({
      where: {
        homeroomTeacherId: input.teacherId,
        academicYear: classRoom.academicYear,
        id: { not: input.classId },
      },
      select: { name: true },
    });
    if (alreadyAssigned) {
      return { ok: false, message: `Ustadz ini sudah menjadi wali kelas ${alreadyAssigned.name} pada tahun ajaran yang sama.` };
    }
  }

  await prisma.classRoom.update({ where: { id: input.classId }, data: { homeroomTeacherId: input.teacherId } });
  revalidateAkademik();
  return { ok: true };
}

export async function placeStudentAction(input: { studentId: string; classId: string }): Promise<ActionResult> {
  await requirePermission("class.manage");
  if (!input.studentId || !input.classId) return { ok: false, message: "Data penempatan tidak valid." };

  const [student, classRoom] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: input.studentId }, select: { id: true } }),
    prisma.classRoom.findUnique({ where: { id: input.classId }, select: { id: true, name: true } }),
  ]);
  if (!student) return { ok: false, message: "Santri tidak ditemukan." };
  if (!classRoom) return { ok: false, message: "Kelas tidak ditemukan." };

  await prisma.studentProfile.update({
    where: { id: input.studentId },
    data: { classRoomId: classRoom.id, className: classRoom.name },
  });
  revalidateAkademik();
  return { ok: true };
}

export async function removeStudentFromClassAction(studentId: string): Promise<ActionResult> {
  await requirePermission("class.manage");
  if (!studentId) return { ok: false, message: "Santri tidak ditemukan." };
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return { ok: false, message: "Santri tidak ditemukan." };

  await prisma.studentProfile.update({ where: { id: studentId }, data: { classRoomId: null } });
  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                            mapel & pengampu                                */
/* -------------------------------------------------------------------------- */

const courseAssignmentSchema = z.object({
  classRoomId: z.string().trim().min(1).nullable(),
  assessmentGroupId: z.string().trim().min(1).nullable(),
  teacherId: z.string().trim().min(1).nullable(),
  reportMaxScore: z.number().int().min(1).max(1000).nullable(),
});

const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Nama mapel wajib diisi.").max(120),
  description: z.string().trim().min(1, "Deskripsi wajib diisi.").max(2000),
  level: z.enum(EducationLevel),
}).and(courseAssignmentSchema);

/**
 * `course.manage` (dipegang mudir) hanya mencakup data mapel itu sendiri.
 * Kelompok penilaian & nilai maksimal rapor adalah wewenang `assessment.configure`
 * dan penempatan kelas wewenang `class.manage` — keduanya juga dipegang mudir,
 * tapi tetap dicek terpisah karena secara skema izinnya bisa berbeda pemegang.
 * Perubahan pada kolom itu ditolak, bukan diabaikan diam-diam.
 */
function checkAssignmentFieldPermissions(
  user: AuthUser,
  next: z.infer<typeof courseAssignmentSchema>,
  current: { classRoomId: string | null; assessmentGroupId: string | null; reportMaxScore: number | null },
): string | null {
  const touchesAssessment =
    next.assessmentGroupId !== current.assessmentGroupId || next.reportMaxScore !== current.reportMaxScore;
  if (touchesAssessment && !userCan(user, "assessment.configure")) {
    return "Kelompok penilaian dan nilai maksimal rapor hanya boleh diubah mudir.";
  }

  if (next.classRoomId !== current.classRoomId && !userCan(user, "class.manage")) {
    return "Penempatan mata pelajaran ke kelas hanya boleh diubah mudir.";
  }

  return null;
}

async function validateCourseAssignment(input: z.infer<typeof courseAssignmentSchema>): Promise<string | null> {
  if (input.classRoomId) {
    const cls = await prisma.classRoom.findUnique({ where: { id: input.classRoomId }, select: { id: true } });
    if (!cls) return "Kelas yang dipilih tidak ditemukan.";
  }
  if (input.assessmentGroupId) {
    const group = await prisma.assessmentGroup.findUnique({ where: { id: input.assessmentGroupId }, select: { id: true } });
    if (!group) return "Kelompok penilaian yang dipilih tidak ditemukan.";
  }
  if (input.teacherId && !(await isVerifiedTeachingStaff(input.teacherId))) {
    return "Pilih pengampu dari akun ustadz/wali kelas yang sudah terverifikasi.";
  }
  return null;
}

export async function createCourseAction(input: {
  title: string;
  description: string;
  level: EducationLevel;
  classRoomId: string | null;
  assessmentGroupId: string | null;
  teacherId: string | null;
  reportMaxScore: number | null;
}): Promise<ActionResult> {
  const admin = await requirePermission("course.manage");
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data mapel tidak valid." };
  }

  const fieldError = checkAssignmentFieldPermissions(admin, parsed.data, {
    classRoomId: null,
    assessmentGroupId: null,
    reportMaxScore: null,
  });
  if (fieldError) return { ok: false, message: fieldError };

  const assignmentError = await validateCourseAssignment(parsed.data);
  if (assignmentError) return { ok: false, message: assignmentError };

  const baseSlug = slugify(parsed.data.title) || `mapel-${Date.now()}`;
  const existingSlug = await prisma.course.findUnique({ where: { slug: baseSlug }, select: { id: true } });

  await prisma.course.create({
    data: {
      title: parsed.data.title,
      slug: existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug,
      description: parsed.data.description,
      level: parsed.data.level,
      classRoomId: parsed.data.classRoomId,
      assessmentGroupId: parsed.data.assessmentGroupId,
      teacherId: parsed.data.teacherId,
      reportMaxScore: parsed.data.reportMaxScore,
      createdById: admin.id,
    },
  });
  revalidateAkademik();
  return { ok: true };
}

export async function updateCourseAssignmentAction(input: {
  courseId: string;
  classRoomId: string | null;
  assessmentGroupId: string | null;
  teacherId: string | null;
  reportMaxScore: number | null;
}): Promise<ActionResult> {
  const user = await requirePermission("course.manage");
  if (!input.courseId) return { ok: false, message: "Mata pelajaran tidak ditemukan." };
  const parsed = courseAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data mapel tidak valid." };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, deletedAt: true, classRoomId: true, assessmentGroupId: true, reportMaxScore: true },
  });
  if (!course || course.deletedAt) return { ok: false, message: "Mata pelajaran tidak ditemukan." };

  const fieldError = checkAssignmentFieldPermissions(user, parsed.data, course);
  if (fieldError) return { ok: false, message: fieldError };

  const assignmentError = await validateCourseAssignment(parsed.data);
  if (assignmentError) return { ok: false, message: assignmentError };

  await prisma.course.update({
    where: { id: input.courseId },
    data: {
      classRoomId: parsed.data.classRoomId,
      assessmentGroupId: parsed.data.assessmentGroupId,
      teacherId: parsed.data.teacherId,
      reportMaxScore: parsed.data.reportMaxScore,
    },
  });
  revalidateAkademik();
  return { ok: true };
}

/**
 * Soft delete: `deletedAt` disaring di semua query aktif (lib/akademik.ts,
 * lib/lms.ts, lib/rapor.ts) sehingga mapel langsung hilang dari daftar aktif,
 * tapi riwayat nilai/absensi/rapor yang sudah terbit tetap utuh — tidak perlu
 * dicek "sedang dipakai" seperti penghapusan permanen.
 */
export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  await requirePermission("course.manage");
  if (!courseId) return { ok: false, message: "Mata pelajaran tidak ditemukan." };

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, deletedAt: true } });
  if (!course || course.deletedAt) {
    return { ok: false, message: "Mata pelajaran tidak ditemukan atau sudah dihapus." };
  }

  await prisma.course.update({ where: { id: courseId }, data: { deletedAt: new Date() } });
  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                             kelompok penilaian                             */
/* -------------------------------------------------------------------------- */

const assessmentGroupSchema = z.object({
  name: z.string().trim().min(1, "Nama kelompok wajib diisi.").max(120),
  kind: z.enum(AssessmentGroupKind),
  defaultMaxScore: z.number().int().min(1).max(1000),
  sortOrder: z.number().int().min(0).max(999),
});

export async function createAssessmentGroupAction(input: {
  name: string;
  kind: AssessmentGroupKind;
  defaultMaxScore: number;
  sortOrder: number;
  academicYear: string;
}): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  const parsed = assessmentGroupSchema.safeParse(input);
  const academicYear = input.academicYear?.trim() ?? "";
  if (!parsed.success || !ACADEMIC_YEAR_RE.test(academicYear)) {
    return { ok: false, message: parsed.success ? "Format tahun ajaran harus mis. 2026/2027." : parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const existing = await prisma.assessmentGroup.findUnique({
    where: { name_academicYear: { name: parsed.data.name, academicYear } },
    select: { id: true },
  });
  if (existing) return { ok: false, message: `Kelompok "${parsed.data.name}" pada tahun ajaran ${academicYear} sudah ada.` };

  await prisma.assessmentGroup.create({ data: { ...parsed.data, academicYear } });
  revalidateAkademik();
  return { ok: true };
}

export async function updateAssessmentGroupAction(input: {
  id: string;
  name: string;
  kind: AssessmentGroupKind;
  defaultMaxScore: number;
  sortOrder: number;
}): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  if (!input.id) return { ok: false, message: "Kelompok penilaian tidak ditemukan." };
  const parsed = assessmentGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const group = await prisma.assessmentGroup.findUnique({ where: { id: input.id }, select: { academicYear: true } });
  if (!group) return { ok: false, message: "Kelompok penilaian tidak ditemukan." };

  const clash = await prisma.assessmentGroup.findFirst({
    where: { name: parsed.data.name, academicYear: group.academicYear, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) return { ok: false, message: `Kelompok "${parsed.data.name}" pada tahun ajaran ${group.academicYear} sudah ada.` };

  await prisma.assessmentGroup.update({ where: { id: input.id }, data: parsed.data });
  revalidateAkademik();
  return { ok: true };
}

export async function deleteAssessmentGroupAction(id: string): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  if (!id) return { ok: false, message: "Kelompok penilaian tidak ditemukan." };
  const courseCount = await prisma.course.count({ where: { assessmentGroupId: id, deletedAt: null } });
  if (courseCount > 0) {
    return {
      ok: false,
      message: `Tidak bisa dihapus: ${courseCount} mata pelajaran masih memakai kelompok ini. Pindahkan mata pelajaran tersebut terlebih dahulu.`,
    };
  }
  await prisma.assessmentGroup.delete({ where: { id } });
  revalidateAkademik();
  return { ok: true };
}

const criterionSchema = z.object({
  name: z.string().trim().min(1, "Nama kriteria wajib diisi.").max(120),
  maxScore: z.number().int().min(1).max(1000),
  sortOrder: z.number().int().min(0).max(999),
});

export async function createBehaviorCriterionAction(input: {
  groupId: string;
  name: string;
  maxScore: number;
  sortOrder: number;
}): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  if (!input.groupId) return { ok: false, message: "Kelompok penilaian tidak ditemukan." };
  const parsed = criterionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const group = await prisma.assessmentGroup.findUnique({ where: { id: input.groupId }, select: { kind: true } });
  if (!group) return { ok: false, message: "Kelompok penilaian tidak ditemukan." };
  if (group.kind !== AssessmentGroupKind.BEHAVIOR) {
    return { ok: false, message: "Kriteria hanya berlaku untuk kelompok bertipe Penilaian Sikap." };
  }

  const existing = await prisma.behaviorCriterion.findUnique({
    where: { groupId_name: { groupId: input.groupId, name: parsed.data.name } },
    select: { id: true },
  });
  if (existing) return { ok: false, message: `Kriteria "${parsed.data.name}" sudah ada pada kelompok ini.` };

  await prisma.behaviorCriterion.create({ data: { groupId: input.groupId, ...parsed.data } });
  revalidateAkademik();
  return { ok: true };
}

export async function updateBehaviorCriterionAction(input: {
  id: string;
  name: string;
  maxScore: number;
  sortOrder: number;
}): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  if (!input.id) return { ok: false, message: "Kriteria tidak ditemukan." };
  const parsed = criterionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const criterion = await prisma.behaviorCriterion.findUnique({ where: { id: input.id }, select: { groupId: true } });
  if (!criterion) return { ok: false, message: "Kriteria tidak ditemukan." };

  const clash = await prisma.behaviorCriterion.findFirst({
    where: { groupId: criterion.groupId, name: parsed.data.name, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) return { ok: false, message: `Kriteria "${parsed.data.name}" sudah ada pada kelompok ini.` };

  await prisma.behaviorCriterion.update({ where: { id: input.id }, data: parsed.data });
  revalidateAkademik();
  return { ok: true };
}

export async function deleteBehaviorCriterionAction(id: string): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  if (!id) return { ok: false, message: "Kriteria tidak ditemukan." };
  const criterion = await prisma.behaviorCriterion.findUnique({ where: { id }, select: { id: true } });
  if (!criterion) return { ok: false, message: "Kriteria tidak ditemukan." };
  await prisma.behaviorCriterion.delete({ where: { id } });
  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                        penanda tangan lembar rapor                         */
/* -------------------------------------------------------------------------- */

const signatorySchema = z.object({
  mudirTitle: z.string().trim().min(1, "Jabatan penanda tangan kiri wajib diisi.").max(80),
  mudirName: z.string().trim().min(1, "Nama penanda tangan kiri wajib diisi.").max(120),
  examChairTitle: z.string().trim().min(1, "Jabatan penanda tangan kanan wajib diisi.").max(80),
  examChairName: z.string().trim().min(1, "Nama penanda tangan kanan wajib diisi.").max(120),
});

/**
 * Nama & jabatan penanda tangan rapor disimpan sebagai AppSetting supaya bisa
 * diganti administrasi saat pengurus pondok berganti, tanpa mengubah kode.
 */
export async function updateReportSignatoriesAction(input: ReportSignatories): Promise<ActionResult> {
  await requirePermission("report.distribute");
  const parsed = signatorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data penanda tangan tidak valid." };

  const fields = Object.keys(REPORT_SIGNATORY_KEYS) as (keyof ReportSignatories)[];
  await prisma.$transaction(
    fields.map((field) =>
      prisma.appSetting.upsert({
        where: { key: REPORT_SIGNATORY_KEYS[field] },
        update: { value: parsed.data[field] },
        create: { key: REPORT_SIGNATORY_KEYS[field], value: parsed.data[field] },
      }),
    ),
  );

  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                          bobot komponen nilai                              */
/* -------------------------------------------------------------------------- */

const weightsSchema = z.object({
  courseId: z.string().trim().min(1),
  semester: z.enum(Semester),
  academicYear: z.string().regex(ACADEMIC_YEAR_RE, "Format tahun ajaran harus mis. 2026/2027."),
  weights: z.array(z.object({ id: z.string().trim().min(1), weight: z.number().int().min(0).max(100) })).min(1),
});

/**
 * Bobot divalidasi per periode: hanya komponen pada semester + tahun ajaran yang
 * sedang diedit yang ikut dijumlahkan, sehingga mapel dengan komponen Ganjil dan
 * Genap tetap bisa mencapai 100% di masing-masing periode.
 */
export async function updateGradeWeightsAction(input: {
  courseId: string;
  semester: Semester;
  academicYear: string;
  weights: { id: string; weight: number }[];
}): Promise<ActionResult> {
  await requirePermission("assessment.configure");
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data bobot tidak valid." };

  const gradeItems = await prisma.gradeItem.findMany({
    where: { courseId: parsed.data.courseId, semester: parsed.data.semester, academicYear: parsed.data.academicYear },
    select: { id: true },
  });
  const knownIds = new Set(gradeItems.map((g) => g.id));
  const submittedIds = new Set(parsed.data.weights.map((w) => w.id));
  const matches = knownIds.size === submittedIds.size && [...knownIds].every((id) => submittedIds.has(id));
  if (!matches) {
    return { ok: false, message: "Komponen nilai tidak sesuai dengan data terkini. Muat ulang halaman dan coba lagi." };
  }

  const total = parsed.data.weights.reduce((sum, w) => sum + w.weight, 0);
  if (total !== 100) {
    return {
      ok: false,
      message: `Total bobot komponen ${formatPeriod(parsed.data)} harus 100%. Saat ini totalnya ${total}%.`,
    };
  }

  await prisma.$transaction(
    parsed.data.weights.map((w) => prisma.gradeItem.update({ where: { id: w.id }, data: { weight: w.weight } })),
  );
  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                          peserta mapel (enrolment)                         */
/* -------------------------------------------------------------------------- */

/**
 * Pasangan santri-mapel yang sudah punya jejak nilai/absensi tidak boleh dihapus
 * (relasi Enrollment tidak menyimpan datanya, tapi menghapus baris membuat riwayat
 * itu tak lagi terbaca sebagai peserta). Pasangan seperti itu di-CANCELLED saja.
 */
async function pairsWithAcademicRecords(studentIds: string[], courseIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0 || courseIds.length === 0) return new Set();

  const [grades, attendances] = await Promise.all([
    prisma.gradeRecord.findMany({
      where: { studentId: { in: studentIds }, gradeItem: { courseId: { in: courseIds } } },
      select: { studentId: true, gradeItem: { select: { courseId: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, attendanceSession: { courseId: { in: courseIds } } },
      select: { studentId: true, attendanceSession: { select: { courseId: true } } },
    }),
  ]);

  const keys = new Set<string>();
  for (const g of grades) keys.add(`${g.studentId}:${g.gradeItem.courseId}`);
  for (const a of attendances) keys.add(`${a.studentId}:${a.attendanceSession.courseId}`);
  return keys;
}

async function unenrollPairs(studentIds: string[], courseIds: string[]): Promise<{ cancelled: number; removed: number }> {
  const protectedPairs = await pairsWithAcademicRecords(studentIds, courseIds);
  const existing = await prisma.enrollment.findMany({
    where: { studentId: { in: studentIds }, courseId: { in: courseIds } },
    select: { id: true, studentId: true, courseId: true },
  });

  const toCancel = existing.filter((e) => protectedPairs.has(`${e.studentId}:${e.courseId}`)).map((e) => e.id);
  const toDelete = existing.filter((e) => !protectedPairs.has(`${e.studentId}:${e.courseId}`)).map((e) => e.id);

  await prisma.$transaction([
    prisma.enrollment.updateMany({ where: { id: { in: toCancel } }, data: { status: EnrollmentStatus.CANCELLED } }),
    prisma.enrollment.deleteMany({ where: { id: { in: toDelete } } }),
  ]);

  return { cancelled: toCancel.length, removed: toDelete.length };
}

export async function setEnrollmentAction(input: {
  studentId: string;
  courseId: string;
  enrolled: boolean;
}): Promise<ActionResult> {
  await requirePermission("course.manage");
  if (!input.studentId || !input.courseId) return { ok: false, message: "Data peserta tidak valid." };

  const [student, course] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: input.studentId }, select: { id: true } }),
    prisma.course.findUnique({ where: { id: input.courseId }, select: { id: true, deletedAt: true } }),
  ]);
  if (!student) return { ok: false, message: "Santri tidak ditemukan." };
  if (!course || course.deletedAt) return { ok: false, message: "Mata pelajaran tidak ditemukan." };

  if (input.enrolled) {
    // Idempoten lewat unique([studentId, courseId]): pendaftaran ulang hanya
    // mengaktifkan kembali baris yang sudah ada.
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: input.studentId, courseId: input.courseId } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { studentId: input.studentId, courseId: input.courseId, status: EnrollmentStatus.ACTIVE },
    });
  } else {
    await unenrollPairs([input.studentId], [input.courseId]);
  }

  revalidateAkademik();
  return { ok: true };
}

export async function setClassEnrollmentAction(input: { classId: string; enrolled: boolean }): Promise<ActionResult> {
  await requirePermission("course.manage");
  if (!input.classId) return { ok: false, message: "Kelas tidak ditemukan." };

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: input.classId },
    select: {
      id: true,
      name: true,
      students: { select: { id: true } },
      courses: { where: { deletedAt: null }, select: { id: true } },
    },
  });
  if (!classRoom) return { ok: false, message: "Kelas tidak ditemukan." };

  const studentIds = classRoom.students.map((s) => s.id);
  const courseIds = classRoom.courses.map((c) => c.id);
  if (studentIds.length === 0) return { ok: false, message: `Kelas ${classRoom.name} belum memiliki santri.` };
  if (courseIds.length === 0) return { ok: false, message: `Belum ada mata pelajaran yang ditetapkan untuk kelas ${classRoom.name}.` };

  if (input.enrolled) {
    const data = studentIds.flatMap((studentId) => courseIds.map((courseId) => ({ studentId, courseId })));
    await prisma.$transaction([
      prisma.enrollment.createMany({ data, skipDuplicates: true }),
      prisma.enrollment.updateMany({
        where: { studentId: { in: studentIds }, courseId: { in: courseIds } },
        data: { status: EnrollmentStatus.ACTIVE },
      }),
    ]);
  } else {
    await unenrollPairs(studentIds, courseIds);
  }

  revalidateAkademik();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                           administrasi santri                             */
/* -------------------------------------------------------------------------- */

const administrationItemSchema = z.object({
  name: z.string().trim().min(1, "Nama item wajib diisi.").max(160),
  description: z.string().trim().max(500).optional().nullable(),
  academicYear: z.string().regex(ACADEMIC_YEAR_RE, "Format tahun ajaran harus mis. 2026/2027."),
  semester: z.enum(Semester),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
});

export async function createAdministrationItemAction(input: {
  name: string;
  description: string | null;
  academicYear: string;
  semester: Semester;
  sortOrder: number;
  active: boolean;
}): Promise<ActionResult> {
  await requirePermission("administration.manage");
  const parsed = administrationItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const existing = await prisma.administrationItem.findUnique({
    where: {
      name_academicYear_semester: { name: parsed.data.name, academicYear: parsed.data.academicYear, semester: parsed.data.semester },
    },
    select: { id: true },
  });
  if (existing) return { ok: false, message: "Item administrasi dengan nama, tahun ajaran, dan semester ini sudah ada." };

  await prisma.administrationItem.create({
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  revalidateAkademik();
  return { ok: true };
}

export async function updateAdministrationItemAction(input: {
  id: string;
  name: string;
  description: string | null;
  academicYear: string;
  semester: Semester;
  sortOrder: number;
  active: boolean;
}): Promise<ActionResult> {
  await requirePermission("administration.manage");
  if (!input.id) return { ok: false, message: "Item administrasi tidak ditemukan." };
  const parsed = administrationItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const item = await prisma.administrationItem.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!item) return { ok: false, message: "Item administrasi tidak ditemukan." };

  const clash = await prisma.administrationItem.findFirst({
    where: {
      name: parsed.data.name,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      id: { not: input.id },
    },
    select: { id: true },
  });
  if (clash) return { ok: false, message: "Item administrasi dengan nama, tahun ajaran, dan semester ini sudah ada." };

  await prisma.administrationItem.update({
    where: { id: input.id },
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  revalidateAkademik();
  return { ok: true };
}

export async function deleteAdministrationItemAction(id: string): Promise<ActionResult> {
  await requirePermission("administration.manage");
  if (!id) return { ok: false, message: "Item administrasi tidak ditemukan." };
  const item = await prisma.administrationItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) return { ok: false, message: "Item administrasi tidak ditemukan." };
  await prisma.administrationItem.delete({ where: { id } });
  revalidateAkademik();
  return { ok: true };
}

export async function setStudentAdministrationAction(input: {
  studentId: string;
  itemId: string;
  fulfilled: boolean;
  note: string;
}): Promise<ActionResult> {
  const admin = await requirePermission("administration.manage");
  if (!input.studentId || !input.itemId) return { ok: false, message: "Data checklist tidak valid." };

  const [student, item] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: input.studentId }, select: { id: true } }),
    prisma.administrationItem.findUnique({ where: { id: input.itemId }, select: { id: true } }),
  ]);
  if (!student) return { ok: false, message: "Santri tidak ditemukan." };
  if (!item) return { ok: false, message: "Item administrasi tidak ditemukan." };

  const note = input.note.trim() || null;
  await prisma.studentAdministration.upsert({
    where: { studentId_itemId: { studentId: input.studentId, itemId: input.itemId } },
    update: { fulfilled: input.fulfilled, note, updatedById: admin.id },
    create: { studentId: input.studentId, itemId: input.itemId, fulfilled: input.fulfilled, note, updatedById: admin.id },
  });
  revalidateAkademik();
  return { ok: true };
}
