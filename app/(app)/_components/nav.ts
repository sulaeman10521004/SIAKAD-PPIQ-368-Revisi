import type { IconKey } from "@/components/ui";
import { hasAnyPermission, permissionsFor, ROLE_BLURB, ROLE_LABEL, type Permission, type Role } from "@/lib/permissions";

export type { Role };
export { ROLE_BLURB, ROLE_LABEL };

export type NavItem = { href: string; label: string; icon: IconKey; permission: Permission | null };

/**
 * Halaman /akademik dipakai dua peran dengan tab yang berbeda, jadi namanya pun
 * berbeda: administrasi menyebutnya "Administrasi Akademik" (penanda tangan
 * rapor + checklist administrasi santri), mudir menyebutnya "Data Akademik"
 * (kelas, mapel, jadwal, peserta, kelompok & bobot penilaian).
 */
export const AKADEMIK_ADMIN_PERMISSIONS = ["administration.manage", "report.distribute"] as const;
export const AKADEMIK_MUDIR_PERMISSIONS = ["class.manage", "course.manage", "assessment.configure"] as const;

export const AKADEMIK_ADMIN_TITLE = "Administrasi Akademik";
export const AKADEMIK_MUDIR_TITLE = "Data Akademik";

/**
 * Pemegang kedua kelompok izin (mis. akun ADMIN + MUDIR) melihat seluruh tab,
 * jadi yang dipakai adalah nama milik administrasi sebagai nama gabungannya.
 */
export function akademikTitle(roles: readonly Role[]): string {
  return hasAnyPermission(roles, AKADEMIK_ADMIN_PERMISSIONS) ? AKADEMIK_ADMIN_TITLE : AKADEMIK_MUDIR_TITLE;
}

// Canonical order. Some routes (permission-dependent label) appear twice; navFor()
// dedupes by href keeping the first match, so list the higher-privilege variant first.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dasbor", icon: "grid", permission: null },
  { href: "/penerimaan", label: "Pendaftaran", icon: "doc", permission: "admission.review" },
  { href: "/pengguna", label: "Pengguna", icon: "users", permission: "user.manage" },
  // Satu href, dua nama. Varian administrasi didaftarkan lebih dulu supaya
  // navFor() yang dedupe-by-href memberi nama "Administrasi Akademik" kepada
  // pemegang izin administrasi (termasuk akun rangkap ADMIN + MUDIR), sedangkan
  // mudir murni jatuh ke varian "Data Akademik" di bawahnya. Kelima izin ini
  // harus tetap sinkron dengan requireAnyPermission([...]) di akademik/page.tsx.
  { href: "/akademik", label: AKADEMIK_ADMIN_TITLE, icon: "settings", permission: "administration.manage" },
  { href: "/akademik", label: AKADEMIK_ADMIN_TITLE, icon: "settings", permission: "report.distribute" },
  { href: "/akademik", label: AKADEMIK_MUDIR_TITLE, icon: "settings", permission: "class.manage" },
  { href: "/akademik", label: AKADEMIK_MUDIR_TITLE, icon: "settings", permission: "course.manage" },
  { href: "/akademik", label: AKADEMIK_MUDIR_TITLE, icon: "settings", permission: "assessment.configure" },
  { href: "/anak", label: "Anak Saya", icon: "users", permission: "child.monitor" },
  { href: "/pendaftaran", label: "Pendaftaran", icon: "doc", permission: "admission.submit" },
  { href: "/jadwal", label: "Jadwal & Mapel", icon: "calendar", permission: "course.view" },
  { href: "/jadwal", label: "Jadwal", icon: "calendar", permission: "schedule.view.own" },
  { href: "/absen", label: "Absensi Santri", icon: "check2", permission: "attendance.record" },
  { href: "/nilai", label: "Nilai", icon: "chart", permission: "grade.manage" },
  { href: "/rapor", label: "Rapor", icon: "award", permission: "report.manage" },
  { href: "/rapor", label: "Penerbitan Rapor", icon: "award", permission: "report.distribute" },
  { href: "/absen-ustadz", label: "Absensi Ustadz", icon: "users", permission: "staff_attendance.view" },
  { href: "/notifikasi", label: "Notifikasi", icon: "bell", permission: null },
  { href: "/pengaturan", label: "Pengaturan", icon: "settings", permission: null },
];

export function navFor(roles: readonly Role[]): NavItem[] {
  const granted = permissionsFor(roles);
  const seen = new Set<string>();
  const items: NavItem[] = [];

  for (const item of NAV_ITEMS) {
    if (item.permission !== null && !granted.has(item.permission)) continue;
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    items.push(item);
  }

  return items;
}

export const PAGE_TITLE: Record<string, string> = {
  "/dashboard": "Dasbor",
  "/penerimaan": "Pendaftaran Santri",
  "/pengguna": "Manajemen Pengguna",
  "/anak": "Anak Saya",
  "/pendaftaran": "Pendaftaran Anak",
  "/nilai": "Nilai",
  "/absen": "Absensi Santri",
  "/absen-ustadz": "Absensi Ustadz",
  "/jadwal": "Jadwal & Mata Pelajaran",
  "/rapor": "Rapor",
  "/notifikasi": "Notifikasi",
  "/pengaturan": "Pengaturan",
};

/** Judul topbar. /akademik sengaja tidak ada di PAGE_TITLE: namanya ikut peran. */
export function pageTitleFor(pathname: string, roles: readonly Role[], fallback: string): string {
  if (pathname === "/akademik") return akademikTitle(roles);
  if (pathname.startsWith("/mapel/")) return "Detail Mata Pelajaran";
  return PAGE_TITLE[pathname] ?? fallback;
}
