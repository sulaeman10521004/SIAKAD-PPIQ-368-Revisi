// Label alur kerja rapor. Sengaja bebas dari Prisma/auth agar aman dipakai
// komponen klien maupun server.

import type { Tone } from "@/components/ui";
import type { ReportCardStatus } from "@/generated/prisma/client";

export const REPORT_STATUS_LABEL: Record<ReportCardStatus, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Menunggu ACC",
  APPROVED: "Disetujui",
  REJECTED: "Dikembalikan",
  PUBLISHED: "Terbit",
};

export const REPORT_STATUS_TONE: Record<ReportCardStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  PUBLISHED: "success",
};

export const REPORT_STATUS_HINT: Record<ReportCardStatus, string> = {
  DRAFT: "Masih disusun wali kelas.",
  SUBMITTED: "Sudah dikirim wali kelas, menunggu ACC administrasi.",
  APPROVED: "Sudah di-ACC administrasi, tinggal diterbitkan.",
  REJECTED: "Dikembalikan administrasi untuk diperbaiki wali kelas.",
  PUBLISHED: "Sudah terbit dan dapat dilihat wali santri.",
};
