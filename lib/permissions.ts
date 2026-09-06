// Pure, client-safe RBAC contract. Do NOT import "@/generated/prisma/client",
// "@/lib/prisma", "next/headers", or any node builtin from this file.

export type Role = "ADMIN" | "TEACHER" | "HOMEROOM" | "MUDIR" | "PARENT";

export const PERMISSIONS = [
  "admission.submit", // wali santri mendaftarkan anak
  "admission.review", // administrasi meninjau PPDB
  "user.manage", // administrasi kelola akun, role, status
  "staff_attendance.view", // akses halaman absensi ustadz
  "staff_attendance.record", // administrasi mencatat kehadiran ustadz lain
  "staff_attendance.self", // ustadz mencatat kehadiran sendiri + isi BKKH
  "course.view", // melihat mapel & jadwal internal pesantren
  "course.manage", // CRUD mapel, ustadz pengampu, peserta, slot jadwal
  "class.manage", // administrasi: kelola kelas, wali kelas, penempatan santri
  "assessment.configure", // administrasi: kelompok penilaian, nilai maksimal, kriteria sikap, bobot
  "administration.manage", // administrasi: checklist administrasi santri
  "schedule.view.own", // wali santri melihat jadwal anaknya
  "attendance.record", // absensi santri per sesi pelajaran
  "grade.manage", // pengelolaan nilai komponen
  "report.manage", // wali kelas: generate, catatan, terbitkan rapor
  "report.approve", // administrasi: ACC rapor kiriman wali kelas
  "report.distribute", // administrasi: pantau & serahkan rapor (read-only)
  "child.monitor", // wali santri: profil, absensi, nilai, rapor anak
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TEACHER_PERMISSIONS = [
  "course.view",
  "staff_attendance.view",
  "staff_attendance.self",
  "attendance.record",
  "grade.manage",
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "admission.review",
    "user.manage",
    "staff_attendance.view",
    "administration.manage",
    "report.approve",
    "report.distribute",
  ],
  TEACHER: TEACHER_PERMISSIONS,
  HOMEROOM: [...TEACHER_PERMISSIONS, "report.manage"],
  MUDIR: ["staff_attendance.view", "course.view", "course.manage", "class.manage", "assessment.configure"],
  PARENT: ["admission.submit", "schedule.view.own", "child.monitor"],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const permissions = new Set<Permission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      permissions.add(permission);
    }
  }

  return permissions;
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export function hasAnyPermission(roles: readonly Role[], permissions: readonly Permission[]): boolean {
  const granted = permissionsFor(roles);
  return permissions.some((permission) => granted.has(permission));
}

export const ROLE_PRECEDENCE: readonly Role[] = ["ADMIN", "MUDIR", "HOMEROOM", "TEACHER", "PARENT"];

export function primaryRole(roles: readonly Role[]): Role {
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return "PARENT";
}

export function sortRoles(roles: readonly Role[]): Role[] {
  return ROLE_PRECEDENCE.filter((role) => roles.includes(role));
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrasi",
  TEACHER: "Ustadz",
  HOMEROOM: "Wali Kelas",
  MUDIR: "Mudir Ma'had",
  PARENT: "Wali Santri",
};

export const ROLE_BLURB: Record<Role, string> = {
  ADMIN: "Kelola pendaftaran, akun, checklist administrasi santri, serta ACC dan penyerahan rapor; memantau absensi ustadz.",
  TEACHER: "Kelola jadwal & mapel, absensi santri, nilai, serta kehadiran dan BKKH pribadi.",
  HOMEROOM: "Kelola jadwal & mapel, absensi santri, nilai, kehadiran dan BKKH pribadi, serta rapor kelas binaan.",
  MUDIR: "Awasi kehadiran ustadz serta kelola mata pelajaran, jadwal, kelas, dan kelompok penilaian.",
  PARENT: "Pantau anak, jadwal, dan pendaftaran.",
};
