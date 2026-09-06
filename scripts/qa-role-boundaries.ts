import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { AttendanceStatus, Prisma, UserRole, UserStatus } from "../generated/prisma/client";
import { SESSION_COOKIE } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { permissionsFor, ROLE_PERMISSIONS, type Permission, type Role } from "../lib/permissions";

type ActionManifest = {
  node: Record<string, { exportedName: string }>;
};

const port = Number(process.env.ROLE_QA_PORT ?? 3100);
const baseUrl = process.env.ROLE_QA_BASE_URL ?? `http://127.0.0.1:${port}`;

const ALL_ROLES: Role[] = ["ADMIN", "TEACHER", "HOMEROOM", "MUDIR", "PARENT"];

/* ------------------------------------------------------------------------- */
/* Pure permission assertions — no database/network. This is what guards    */
/* the RBAC contract itself and always runs, even when the DB is down.      */
/* ------------------------------------------------------------------------- */
function runPermissionAssertions() {
  // Each role's granted set matches ROLE_PERMISSIONS exactly.
  for (const role of ALL_ROLES) {
    const granted = [...permissionsFor([role])].sort();
    const expected = [...ROLE_PERMISSIONS[role]].sort();
    assert.deepEqual(granted, expected, `permissionsFor(["${role}"]) menyimpang dari ROLE_PERMISSIONS.${role}.`);
  }

  // Union property: two roles combined grant exactly the union of each role alone,
  // and strictly more than either role alone (this is the "2 roles = union" guarantee).
  const adminOnly = permissionsFor(["ADMIN"]);
  const mudirOnly = permissionsFor(["MUDIR"]);
  const combined = permissionsFor(["ADMIN", "MUDIR"]);
  const expectedUnion = new Set<Permission>([...adminOnly, ...mudirOnly]);

  assert.deepEqual(
    [...combined].sort(),
    [...expectedUnion].sort(),
    'permissionsFor(["ADMIN","MUDIR"]) tidak sama dengan union izin ADMIN dan MUDIR.',
  );
  assert.ok(combined.size > adminOnly.size, "Union ADMIN+MUDIR semestinya lebih besar dari ADMIN saja.");
  assert.ok(combined.size > mudirOnly.size, "Union ADMIN+MUDIR semestinya lebih besar dari MUDIR saja.");
  for (const permission of combined) {
    assert.ok(
      adminOnly.has(permission) || mudirOnly.has(permission),
      `Union ADMIN+MUDIR memuat izin ${permission} yang tidak diberikan oleh salah satu peran.`,
    );
  }

  // Product rules requested by the user, as named checks.
  // Administrasi kini menyiapkan kelas, mapel, dan penilaian, jadi course.manage ikut diberikan.
  assert.ok(adminOnly.has("course.manage"), "ADMIN semestinya punya course.manage.");
  assert.ok(adminOnly.has("class.manage"), "ADMIN semestinya punya class.manage.");
  assert.ok(adminOnly.has("assessment.configure"), "ADMIN semestinya punya assessment.configure.");
  assert.ok(adminOnly.has("administration.manage"), "ADMIN semestinya punya administration.manage.");
  assert.ok(adminOnly.has("report.approve"), "ADMIN semestinya punya report.approve.");
  assert.ok(!adminOnly.has("grade.manage"), "ADMIN semestinya tidak punya grade.manage.");

  assert.ok(!mudirOnly.has("report.manage"), "MUDIR semestinya tidak punya report.manage.");
  assert.ok(!mudirOnly.has("grade.manage"), "MUDIR semestinya tidak punya grade.manage.");
  assert.ok(!mudirOnly.has("attendance.record"), "MUDIR semestinya tidak punya attendance.record.");

  const parentOnly = permissionsFor(["PARENT"]);
  const staffPermissions: Permission[] = ["staff_attendance.view", "staff_attendance.record", "staff_attendance.self"];
  for (const permission of staffPermissions) {
    assert.ok(!parentOnly.has(permission), `PARENT semestinya tidak punya ${permission}.`);
  }

  const teacherOnly = permissionsFor(["TEACHER"]);
  const homeroomOnly = permissionsFor(["HOMEROOM"]);
  assert.ok(homeroomOnly.size > teacherOnly.size, "HOMEROOM semestinya superset ketat dari TEACHER.");
  for (const permission of teacherOnly) {
    assert.ok(homeroomOnly.has(permission), `HOMEROOM kehilangan izin TEACHER: ${permission}.`);
  }

  for (const role of ALL_ROLES) {
    const granted = permissionsFor([role]);
    if (role === "ADMIN") {
      assert.ok(granted.has("report.distribute"), "ADMIN semestinya punya report.distribute.");
    } else {
      assert.ok(!granted.has("report.distribute"), `${role} semestinya tidak punya report.distribute.`);
    }
    if (role === "HOMEROOM") {
      assert.ok(granted.has("report.manage"), "HOMEROOM semestinya punya report.manage.");
    } else {
      assert.ok(!granted.has("report.manage"), `${role} semestinya tidak punya report.manage.`);
    }
  }

  console.log(
    "Permission assertions passed: per-role contract, union property (ADMIN+MUDIR), and product rules (ADMIN/MUDIR/PARENT/HOMEROOM-TEACHER/report.*).",
  );
}

/* ------------------------------------------------------------------------- */
/* DB/HTTP-backed QA — exercises the live server + database. Requires a     */
/* reachable database and a built Next.js app; skipped (not crashed) when   */
/* unavailable so the pure permission assertions above remain the source of */
/* truth even offline.                                                      */
/* ------------------------------------------------------------------------- */

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Thrown when the local QA server never comes up — treated as connectivity, not assertion, failure. */
class QaServerUnreachableError extends Error {
  readonly code = "ECONNREFUSED" as const;
}

/**
 * True only for genuine "can't reach the database/server" failures (Prisma
 * P1001/P1002/P1008/P1017 init errors, ECONNREFUSED/ENOTFOUND/ETIMEDOUT
 * connect errors, and our own QaServerUnreachableError). Everything else —
 * assertion failures above all — must be reported as a real QA failure.
 */
const CONNECTIVITY_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const CONNECTIVITY_SYSCALL_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"]);

function isDatabaseConnectivityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return error.errorCode === undefined || CONNECTIVITY_PRISMA_CODES.has(error.errorCode);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return CONNECTIVITY_PRISMA_CODES.has(error.code);
  }
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code && CONNECTIVITY_SYSCALL_CODES.has(code)) return true;
  // fetch() network failures surface as a TypeError whose `cause` carries the syscall code.
  const causeCode = (error as { cause?: NodeJS.ErrnoException } | undefined)?.cause?.code;
  if (causeCode && CONNECTIVITY_SYSCALL_CODES.has(causeCode)) return true;
  return false;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new QaServerUnreachableError(`Server QA tidak siap di ${baseUrl}`);
}

async function ensureServer() {
  try {
    const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    if (response.status < 500) return null;
  } catch {
    // Start a local production server below.
  }

  const child = spawn(
    process.execPath,
    [resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );
  await waitForServer();
  return child;
}

async function createQaSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sessionHash(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    select: { id: true },
  });
  return { id: session.id, cookie: `${SESSION_COOKIE}=${token}` };
}

async function invokeAction(actionId: string, path: string, cookie: string, input: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      Cookie: cookie,
      Origin: baseUrl,
      "Next-Action": actionId,
    },
    body: JSON.stringify([input]),
  });
  const body = await response.text();
  assert.ok(response.status < 500, `Action ${path} gagal dengan HTTP ${response.status}: ${body}`);
  return body;
}

async function runDbAssertions() {
  const server: ChildProcess | null = await ensureServer();
  const manifest = JSON.parse(
    await readFile(".next/server/server-reference-manifest.json", "utf8"),
  ) as ActionManifest;
  const actionId = (name: string) => {
    const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
    assert.ok(entry, `Server action ${name} tidak ditemukan pada build manifest.`);
    return entry[0];
  };

  const [admin, homeroom, mudir] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: "administrasi@ppiq368.sch.id" },
      select: { id: true },
    }),
    prisma.user.findUniqueOrThrow({
      // Wali kelas berperan tunggal (HOMEROOM); akun wali kelas SD-A sengaja
      // tidak dipakai di sini karena memegang dua peran.
      where: { email: "salman.ghifari@ppiq368.sch.id" },
      select: { id: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "mudir@ppiq368.sch.id" },
      select: { id: true },
    }),
  ]);

  const assignedCourse = await prisma.course.findFirstOrThrow({
    where: { teacherId: homeroom.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      gradeItems: { take: 1, select: { id: true } },
      attendanceSessions: { take: 1, select: { id: true } },
    },
  });

  // Judul mata pelajaran berulang di setiap kelas (mis. "Ilmu Tajwid" ada di
  // SD-A, SMP-A, dan SMA-A). Pemeriksaan di bawah membuktikan judul mapel asing
  // tidak muncul di halaman Nilai, jadi mapel pembanding harus berjudul unik
  // terhadap seluruh mapel yang memang diampu wali kelas ini; kalau tidak,
  // asersi bisa gagal hanya karena judulnya kebetulan sama.
  const ownTitles = (
    await prisma.course.findMany({
      where: { teacherId: homeroom.id, deletedAt: null },
      select: { title: true },
    })
  ).map((course) => course.title);

  const foreignCourse = await prisma.course.findFirstOrThrow({
    where: { teacherId: { not: homeroom.id }, deletedAt: null, title: { notIn: ownTitles } },
    select: {
      id: true,
      title: true,
      gradeItems: { take: 1, select: { id: true } },
      attendanceSessions: { take: 1, select: { id: true } },
    },
  });
  assert.ok(assignedCourse.gradeItems[0] && assignedCourse.attendanceSessions[0]);
  assert.ok(foreignCourse.gradeItems[0] && foreignCourse.attendanceSessions[0]);

  const qaSuffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const [unenrolledStudent, foreignStudent] = await Promise.all([
    prisma.studentProfile.create({
      data: { name: "QA Tidak Terdaftar", studentNumber: `QA-U-${qaSuffix}`, className: "QA" },
      select: { id: true },
    }),
    prisma.studentProfile.create({
      data: {
        name: "QA Mapel Lain",
        studentNumber: `QA-F-${qaSuffix}`,
        className: "QA",
        enrollments: { create: { courseId: foreignCourse.id } },
      },
      select: { id: true },
    }),
  ]);
  const [adminSession, homeroomSession, mudirSession] = await Promise.all([
    createQaSession(admin.id),
    createQaSession(homeroom.id),
    createQaSession(mudir.id),
  ]);

  try {
    const gradeAction = actionId("saveGradeAction");
    const attendanceAction = actionId("setAttendanceStatusAction");
    const updateUserAction = actionId("updateUserAction");

    const mudirDashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: mudirSession.cookie },
      redirect: "manual",
    });
    const mudirDashboardHtml = await mudirDashboard.text();
    assert.equal(mudirDashboard.status, 200);
    // Shared chrome (hero/stats) renders once, with the Mudir-specific stat set…
    assert.ok(mudirDashboardHtml.includes("Kelengkapan BKKH"));
    // …composed with the Mudir-only attention list and quick links below it.
    assert.ok(mudirDashboardHtml.includes("Perlu ditindaklanjuti"));
    assert.ok(mudirDashboardHtml.includes("Pengawasan akademik"));

    const nilaiPage = await fetch(`${baseUrl}/nilai`, {
      headers: { Cookie: homeroomSession.cookie },
      redirect: "manual",
    });
    const nilaiHtml = await nilaiPage.text();
    assert.equal(nilaiPage.status, 200);
    assert.ok(nilaiHtml.includes(assignedCourse.title), "Mapel Wali Kelas yang ditugaskan tidak tampil.");
    assert.ok(!nilaiHtml.includes(foreignCourse.title), "Wali Kelas masih melihat mapel yang tidak ditugaskan.");

    const foreignDetail = await fetch(`${baseUrl}/mapel/${foreignCourse.id}`, {
      headers: { Cookie: homeroomSession.cookie },
      redirect: "manual",
    });
    assert.equal(foreignDetail.status, 404, "Detail mapel asing tidak ditolak untuk Wali Kelas.");

    const reportPage = await fetch(`${baseUrl}/rapor`, {
      headers: { Cookie: homeroomSession.cookie },
      redirect: "manual",
    });
    assert.equal(reportPage.status, 200, "Akses rapor Wali Kelas ikut terblokir.");

    const foreignGradeResponse = await invokeAction(gradeAction, "/nilai", homeroomSession.cookie, {
      gradeItemId: foreignCourse.gradeItems[0].id,
      studentId: foreignStudent.id,
      value: 77,
    });
    assert.ok(foreignGradeResponse.includes("tidak ditugaskan"));

    const foreignAttendanceResponse = await invokeAction(attendanceAction, "/absen", homeroomSession.cookie, {
      sessionId: foreignCourse.attendanceSessions[0].id,
      studentId: foreignStudent.id,
      status: AttendanceStatus.PRESENT,
    });
    assert.ok(foreignAttendanceResponse.includes("tidak ditugaskan"));

    const unenrolledGradeResponse = await invokeAction(gradeAction, "/nilai", homeroomSession.cookie, {
      gradeItemId: assignedCourse.gradeItems[0].id,
      studentId: unenrolledStudent.id,
      value: 88,
    });
    assert.ok(unenrolledGradeResponse.includes("tidak terdaftar"));

    const unenrolledAttendanceResponse = await invokeAction(attendanceAction, "/absen", homeroomSession.cookie, {
      sessionId: assignedCourse.attendanceSessions[0].id,
      studentId: unenrolledStudent.id,
      status: AttendanceStatus.PRESENT,
    });
    assert.ok(unenrolledAttendanceResponse.includes("tidak terdaftar"));

    const userUpdateResponse = await invokeAction(updateUserAction, "/pengguna", adminSession.cookie, {
      userId: homeroom.id,
      name: homeroom.name,
      roles: [UserRole.MUDIR],
      status: UserStatus.VERIFIED,
    });
    assert.ok(userUpdateResponse.includes("Alihkan seluruh mata pelajaran"));

    const [forgedGrades, forgedAttendance, homeroomAfter] = await Promise.all([
      prisma.gradeRecord.count({
        where: { studentId: { in: [unenrolledStudent.id, foreignStudent.id] } },
      }),
      prisma.attendanceRecord.count({
        where: { studentId: { in: [unenrolledStudent.id, foreignStudent.id] } },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: homeroom.id },
        select: { roles: true, status: true },
      }),
    ]);
    assert.equal(forgedGrades, 0, "Forged grade action sempat menulis record.");
    assert.equal(forgedAttendance, 0, "Forged attendance action sempat menulis record.");
    assert.deepEqual(homeroomAfter.roles, [UserRole.HOMEROOM]);
    assert.equal(homeroomAfter.status, UserStatus.VERIFIED);

    console.log(
      "DB-backed role QA passed: Mudir dashboard, assigned-course scope, report access, forged writes, and assignee account protection.",
    );
  } finally {
    // Kill the spawned server FIRST: it holds the event loop open, so if any
    // cleanup query below throws the script would otherwise hang forever.
    server?.kill("SIGTERM");

    // Each cleanup step is independent — one failure must not skip the rest.
    for (const cleanup of [
      () =>
        prisma.user.update({
          where: { id: homeroom.id },
          data: { roles: [UserRole.HOMEROOM], status: UserStatus.VERIFIED },
        }),
      () =>
        prisma.session.deleteMany({
          where: { id: { in: [adminSession.id, homeroomSession.id, mudirSession.id] } },
        }),
      () =>
        prisma.studentProfile.deleteMany({
          where: { id: { in: [unenrolledStudent.id, foreignStudent.id] } },
        }),
    ]) {
      await cleanup().catch((error) => {
        console.warn("Cleanup QA gagal (dilanjutkan):", error instanceof Error ? error.message : error);
      });
    }
  }
}

async function main() {
  // Pure permission assertions run first and independently — they are the
  // regression guard on the RBAC contract itself and need no database.
  runPermissionAssertions();

  try {
    await runDbAssertions();
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      console.warn(
        "DB-backed role QA dilewati (database/server tidak terjangkau):",
        error instanceof Error ? error.message : error,
      );
    } else {
      console.error("DB-backed role QA GAGAL:", error);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
