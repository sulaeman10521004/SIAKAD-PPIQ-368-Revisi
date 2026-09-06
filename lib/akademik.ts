import { cache } from "react";
import { EducationLevel, EnrollmentStatus, Semester, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateKey, type Period } from "@/lib/lms";

/* -------------------------------------------------------------------------- */
/*                                    kelas                                   */
/* -------------------------------------------------------------------------- */

export const getClassBoard = cache(async () => {
  const [classes, unassignedStudents, homeroomCandidates] = await Promise.all([
    prisma.classRoom.findMany({
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        level: true,
        academicYear: true,
        homeroomTeacherId: true,
        homeroomTeacher: { select: { id: true, name: true } },
        students: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, studentNumber: true, level: true },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: { classRoomId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, studentNumber: true, level: true, className: true },
    }),
    prisma.user.findMany({
      where: { roles: { has: UserRole.HOMEROOM }, status: UserStatus.VERIFIED },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      academicYear: c.academicYear,
      homeroomTeacherId: c.homeroomTeacherId,
      homeroomTeacherName: c.homeroomTeacher?.name ?? null,
      students: c.students,
    })),
    unassignedStudents,
    homeroomCandidates,
  };
});

/* -------------------------------------------------------------------------- */
/*                            mapel & pengampu                                */
/* -------------------------------------------------------------------------- */

export const getCourseBoard = cache(async () => {
  const [courses, assessmentGroups, classRooms, teachingStaff] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        level: true,
        reportMaxScore: true,
        classRoomId: true,
        classRoom: { select: { id: true, name: true } },
        assessmentGroupId: true,
        assessmentGroup: { select: { id: true, name: true } },
        teacherId: true,
        teacher: { select: { id: true, name: true } },
      },
    }),
    prisma.assessmentGroup.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, level: true } }),
    prisma.user.findMany({
      where: { roles: { hasSome: [UserRole.TEACHER, UserRole.HOMEROOM] }, status: UserStatus.VERIFIED },
      orderBy: { name: "asc" },
      select: { id: true, name: true, roles: true },
    }),
  ]);

  return {
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      level: c.level,
      reportMaxScore: c.reportMaxScore,
      classRoomId: c.classRoomId,
      className: c.classRoom?.name ?? null,
      assessmentGroupId: c.assessmentGroupId,
      assessmentGroupName: c.assessmentGroup?.name ?? null,
      teacherId: c.teacherId,
      teacherName: c.teacher?.name ?? null,
    })),
    assessmentGroups,
    classRooms,
    teachingStaff,
  };
});

/* -------------------------------------------------------------------------- */
/*                             kelompok penilaian                             */
/* -------------------------------------------------------------------------- */

export const getAssessmentGroupBoard = cache(async () => {
  const groups = await prisma.assessmentGroup.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      defaultMaxScore: true,
      sortOrder: true,
      academicYear: true,
      _count: { select: { courses: true } },
      criteria: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, maxScore: true, sortOrder: true },
      },
    },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    defaultMaxScore: g.defaultMaxScore,
    sortOrder: g.sortOrder,
    academicYear: g.academicYear,
    courseCount: g._count.courses,
    criteria: g.criteria,
  }));
});

/* -------------------------------------------------------------------------- */
/*                          bobot komponen nilai                              */
/* -------------------------------------------------------------------------- */

/**
 * Bobot hanya bermakna dalam satu periode: komponen semester Ganjil dan Genap
 * pada mapel yang sama masing-masing harus berjumlah 100%, bukan digabung.
 */
export const getGradeWeightBoard = cache(async (semester: Semester, academicYear: string) => {
  const [courses, periodRows] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        classRoom: { select: { name: true } },
        gradeItems: {
          where: { semester, academicYear },
          orderBy: { title: "asc" },
          select: { id: true, title: true, maxScore: true, weight: true, dueAt: true, records: { select: { id: true } } },
        },
      },
    }),
    prisma.gradeItem.findMany({
      distinct: ["semester", "academicYear"],
      orderBy: [{ academicYear: "desc" }, { semester: "asc" }],
      select: { semester: true, academicYear: true },
    }),
  ]);

  // Periode yang sedang dipilih selalu tersedia, walau belum punya komponen.
  const periods: Period[] = [...periodRows];
  if (!periods.some((p) => p.semester === semester && p.academicYear === academicYear)) {
    periods.unshift({ semester, academicYear });
  }

  return {
    period: { semester, academicYear } satisfies Period,
    periods,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      className: c.classRoom?.name ?? null,
      items: c.gradeItems.map((i) => ({
        id: i.id,
        title: i.title,
        maxScore: i.maxScore,
        weight: i.weight,
        dueAt: i.dueAt ? toDateKey(i.dueAt) : "",
        recordCount: i.records.length,
      })),
      weightSum: c.gradeItems.reduce((sum, i) => sum + i.weight, 0),
      zeroWeightCount: c.gradeItems.filter((i) => i.weight === 0).length,
    })),
  };
});

/* -------------------------------------------------------------------------- */
/*                          peserta mapel (enrolment)                         */
/* -------------------------------------------------------------------------- */

export const getEnrollmentBoard = cache(async () => {
  const [classes, enrollments, coursesWithoutClass] = await Promise.all([
    prisma.classRoom.findMany({
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        level: true,
        academicYear: true,
        students: { orderBy: { name: "asc" }, select: { id: true, name: true, studentNumber: true } },
        courses: {
          where: { deletedAt: null },
          orderBy: { title: "asc" },
          select: { id: true, title: true, teacher: { select: { name: true } } },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: { course: { deletedAt: null, classRoomId: { not: null } } },
      select: { studentId: true, courseId: true, status: true },
    }),
    prisma.course.findMany({
      where: { deletedAt: null, classRoomId: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const byCourse = new Map<string, { active: Set<string>; other: Set<string> }>();
  for (const e of enrollments) {
    const entry = byCourse.get(e.courseId) ?? { active: new Set<string>(), other: new Set<string>() };
    (e.status === EnrollmentStatus.ACTIVE ? entry.active : entry.other).add(e.studentId);
    byCourse.set(e.courseId, entry);
  }

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      academicYear: c.academicYear,
      students: c.students,
      courses: c.courses.map((course) => {
        const entry = byCourse.get(course.id);
        const active = entry?.active ?? new Set<string>();
        return {
          id: course.id,
          title: course.title,
          teacherName: course.teacher?.name ?? null,
          // Peserta aktif keseluruhan (termasuk santri yang sudah pindah kelas).
          activeCount: active.size,
          activeStudentIds: [...active],
          inactiveStudentIds: [...(entry?.other ?? new Set<string>())],
        };
      }),
    })),
    coursesWithoutClass,
  };
});

/* -------------------------------------------------------------------------- */
/*                           administrasi santri                             */
/* -------------------------------------------------------------------------- */

export const getAdministrationBoard = cache(async () => {
  const [items, students, records, users] = await Promise.all([
    prisma.administrationItem.findMany({
      orderBy: [{ academicYear: "desc" }, { semester: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        academicYear: true,
        semester: true,
        sortOrder: true,
        active: true,
      },
    }),
    prisma.studentProfile.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, studentNumber: true, className: true },
    }),
    prisma.studentAdministration.findMany({
      select: { studentId: true, itemId: true, fulfilled: true, note: true, updatedById: true, updatedAt: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    items,
    students,
    records: records.map((r) => ({
      studentId: r.studentId,
      itemId: r.itemId,
      fulfilled: r.fulfilled,
      note: r.note,
      updatedByName: r.updatedById ? userNameById.get(r.updatedById) ?? null : null,
      updatedAt: r.updatedAt,
    })),
  };
});

/** Level jenjang yang tersedia untuk formulir kelas. */
export const EDUCATION_LEVELS = Object.values(EducationLevel);
