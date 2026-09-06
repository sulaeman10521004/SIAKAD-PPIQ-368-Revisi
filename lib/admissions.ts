import { cache } from "react";
import { AdmissionDocumentKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/*                            berkas pendaftaran                              */
/* -------------------------------------------------------------------------- */

// Urutan tampil berkas syarat pendaftaran (form wali & tinjauan administrasi).
export const ADMISSION_DOCUMENT_KINDS = [
  AdmissionDocumentKind.FAMILY_CARD,
  AdmissionDocumentKind.BIRTH_CERTIFICATE,
  AdmissionDocumentKind.PREVIOUS_REPORT,
  AdmissionDocumentKind.PHOTO,
  AdmissionDocumentKind.PAYMENT_PROOF,
] as const;

export const ADMISSION_DOCUMENT_LABEL: Record<AdmissionDocumentKind, string> = {
  FAMILY_CARD: "Kartu Keluarga",
  BIRTH_CERTIFICATE: "Akta Kelahiran",
  PREVIOUS_REPORT: "Rapor Terakhir",
  PHOTO: "Pas Foto",
  PAYMENT_PROOF: "Bukti Pembayaran Pendaftaran",
};

export const ADMISSION_DOCUMENT_REQUIRED: Record<AdmissionDocumentKind, boolean> = {
  FAMILY_CARD: true,
  BIRTH_CERTIFICATE: true,
  PREVIOUS_REPORT: true,
  PHOTO: true,
  PAYMENT_PROOF: true,
};

// Nama input berkas pada form pendaftaran.
export const ADMISSION_DOCUMENT_FIELD: Record<AdmissionDocumentKind, string> = {
  FAMILY_CARD: "familyCardFile",
  BIRTH_CERTIFICATE: "birthCertificateFile",
  PREVIOUS_REPORT: "previousReportFile",
  PHOTO: "photoFile",
  PAYMENT_PROOF: "paymentProofFile",
};

// Nama input tautan pada form pendaftaran (sengaja sama dengan nama kolomnya).
export const ADMISSION_DOCUMENT_URL_FIELD: Record<AdmissionDocumentKind, string> = {
  FAMILY_CARD: "familyCardUrl",
  BIRTH_CERTIFICATE: "birthCertificateUrl",
  PREVIOUS_REPORT: "previousReportUrl",
  PHOTO: "photoUrl",
  PAYMENT_PROOF: "paymentProofUrl",
};

/**
 * Kolom URL pada `Admission`. Wali santri boleh memilih per dokumen: mengunggah
 * berkas (tersimpan sebagai `AdmissionDocument`) atau mengisi tautan (tersimpan
 * di kolom ini), jadi kolom-kolom ini dipakai lagi — bukan sekadar peninggalan.
 */
export const ADMISSION_DOCUMENT_URL_COLUMN: Record<
  AdmissionDocumentKind,
  "familyCardUrl" | "birthCertificateUrl" | "previousReportUrl" | "photoUrl" | "paymentProofUrl"
> = {
  FAMILY_CARD: "familyCardUrl",
  BIRTH_CERTIFICATE: "birthCertificateUrl",
  PREVIOUS_REPORT: "previousReportUrl",
  PHOTO: "photoUrl",
  PAYMENT_PROOF: "paymentProofUrl",
};

export const ADMISSION_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;

// Hanya tiga tipe ini yang boleh disimpan sekaligus disajikan ulang oleh
// /api/dokumen, sehingga berkas tidak pernah dieksekusi di browser.
export const ADMISSION_DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export type AdmissionDocumentMimeType = (typeof ADMISSION_DOCUMENT_MIME_TYPES)[number];

export const ADMISSION_DOCUMENT_ACCEPT = ADMISSION_DOCUMENT_MIME_TYPES.join(",");

export function isAdmissionDocumentMimeType(value: string): value is AdmissionDocumentMimeType {
  return (ADMISSION_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}

/* ------------------------------- pemeriksaan ------------------------------- */

const MAGIC_BYTES: { mime: AdmissionDocumentMimeType; signature: readonly number[] }[] = [
  { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
];

// Tipe asli berkas dibaca dari magic bytes; header Content-Type dari browser
// tidak bisa dipercaya.
export function sniffAdmissionDocumentMimeType(bytes: Uint8Array): AdmissionDocumentMimeType | null {
  for (const { mime, signature } of MAGIC_BYTES) {
    if (bytes.length < signature.length) continue;
    if (signature.every((byte, i) => bytes[i] === byte)) return mime;
  }

  return null;
}

export type AdmissionDocumentIssueReason =
  | "required"
  | "size"
  | "type"
  | "mismatch"
  | "empty"
  | "both"
  | "url";

export type AdmissionDocumentIssue = {
  kind: AdmissionDocumentKind;
  reason: AdmissionDocumentIssueReason;
};

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  const mb = (size / (1024 * 1024)).toFixed(1);
  return `${(mb.endsWith(".0") ? mb.slice(0, -2) : mb).replace(".", ",")} MB`;
}

export function admissionDocumentIssueMessage(issue: AdmissionDocumentIssue): string {
  const label = ADMISSION_DOCUMENT_LABEL[issue.kind];

  switch (issue.reason) {
    case "required":
      return `${label} wajib dilengkapi. Pilih salah satu: unggah berkas atau isi tautan (URL).`;
    case "both":
      return `${label} hanya boleh diisi salah satu: unggah berkas atau tautan (URL), bukan keduanya.`;
    case "url":
      return `Tautan ${label} tidak valid. Gunakan alamat yang diawali http:// atau https://.`;
    case "empty":
      return `Berkas ${label} kosong. Unggah ulang berkas yang benar.`;
    case "size":
      return `Ukuran berkas ${label} melebihi batas ${formatFileSize(ADMISSION_DOCUMENT_MAX_BYTES)} per dokumen.`;
    case "type":
      return `Format berkas ${label} tidak didukung. Gunakan file JPG, PNG, atau PDF.`;
    case "mismatch":
      return `Isi berkas ${label} tidak sesuai dengan ekstensinya. Unggah ulang file JPG, PNG, atau PDF yang asli.`;
  }
}

export type AdmissionDocumentUpload = {
  kind: AdmissionDocumentKind;
  filename: string;
  mimeType: AdmissionDocumentMimeType;
  size: number;
  // Prisma `Bytes` memakai Uint8Array<ArrayBuffer>, bukan ArrayBufferLike.
  data: Uint8Array<ArrayBuffer>;
};

export type AdmissionDocumentInput = {
  kind: AdmissionDocumentKind;
  filename: string;
  declaredMimeType: string;
  bytes: Uint8Array<ArrayBuffer>;
};

const MIME_EXTENSION: Record<AdmissionDocumentMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

export function mimeTypeLabel(mimeType: string): string {
  if (mimeType === "image/jpeg") return "JPG";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "application/pdf") return "PDF";
  return mimeType;
}

export type AdmissionDocumentCheck =
  | { ok: true; document: AdmissionDocumentUpload }
  | { ok: false; issue: AdmissionDocumentIssue };

// Nama berkas dari browser bisa berisi path, kutip, atau karakter kontrol yang
// merusak header Content-Disposition; sisakan karakter ASCII yang aman saja.
export function sanitizeFilename(filename: string, fallback: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._ ()-]+/g, "_").replace(/^[._ ]+/, "").trim();
  return cleaned.slice(0, 120) || fallback;
}

export function checkAdmissionDocument(input: AdmissionDocumentInput): AdmissionDocumentCheck {
  const { kind, bytes } = input;

  if (bytes.length === 0) {
    return { ok: false, issue: { kind, reason: "empty" } };
  }

  if (bytes.length > ADMISSION_DOCUMENT_MAX_BYTES) {
    return { ok: false, issue: { kind, reason: "size" } };
  }

  const declared = input.declaredMimeType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!isAdmissionDocumentMimeType(declared)) {
    return { ok: false, issue: { kind, reason: "type" } };
  }

  const sniffed = sniffAdmissionDocumentMimeType(bytes);

  if (!sniffed) {
    return { ok: false, issue: { kind, reason: "mismatch" } };
  }

  if (sniffed !== declared) {
    return { ok: false, issue: { kind, reason: "mismatch" } };
  }

  return {
    ok: true,
    document: {
      kind,
      filename: sanitizeFilename(input.filename, `${kind.toLowerCase()}${MIME_EXTENSION[sniffed]}`),
      mimeType: sniffed,
      size: bytes.length,
      data: bytes,
    },
  };
}

/**
 * URL berkas dulu divalidasi dengan `z.string().url()` yang masih menerima skema
 * berbahaya seperti `javascript:`. Hanya http/https yang boleh disimpan maupun
 * dirender sebagai tautan; nilai tanpa skema (mis. `//evil.com`) ikut ditolak
 * karena `new URL()` tanpa base akan melemparkan galat.
 *
 * Yang dikembalikan adalah bentuk ternormalisasi (`parsed.href`), bukan masukan
 * mentah, supaya nilai yang tersimpan sama persis dengan yang sudah diperiksa.
 */
export function safeDocumentUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/* -------------------------------- tanggal ---------------------------------- */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EARLIEST_BIRTH_YEAR = 1900;

export type AdmissionBirthDateResult =
  | { ok: true; value: Date | null }
  | { ok: false; reason: "birthDate" | "birthDateFuture" };

export const ADMISSION_BIRTH_DATE_MESSAGE: Record<"birthDate" | "birthDateFuture", string> = {
  birthDate: "Tanggal lahir tidak valid. Pilih tanggal dari kalender atau isi dengan format tahun-bulan-tanggal.",
  birthDateFuture: "Tanggal lahir tidak boleh melewati hari ini. Periksa kembali tanggal lahir santri.",
};

/**
 * Prisma menolak `Invalid Date` dengan galat mentah, jadi tanggal lahir divalidasi
 * sendiri: hanya format YYYY-MM-DD (sesuai <input type="date">), tanggal yang benar
 * ada, tidak di masa depan, dan tidak mustahil tuanya. Dipakai bersama oleh formulir
 * wali santri dan formulir pendaftaran manual milik administrasi.
 */
export function parseAdmissionBirthDate(raw: string | undefined | null, now = new Date()): AdmissionBirthDateResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, value: null };

  const match = DATE_ONLY_RE.exec(value);
  if (!match) return { ok: false, reason: "birthDate" };

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate || year < EARLIEST_BIRTH_YEAR) return { ok: false, reason: "birthDate" };
  if (date.getTime() > now.getTime()) return { ok: false, reason: "birthDateFuture" };

  return { ok: true, value: date };
}

/** Nilai untuk <input type="date">; null bila tanggal lahir belum diisi. */
export function toDateInputValue(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/* ------------------------- pilihan unggahan / tautan ------------------------ */

export type AdmissionDocumentSubmission =
  | { kind: AdmissionDocumentKind; mode: "upload"; document: AdmissionDocumentUpload }
  | { kind: AdmissionDocumentKind; mode: "url"; url: string }
  | { kind: AdmissionDocumentKind; mode: "none" };

export type AdmissionDocumentSubmissionInput = {
  kind: AdmissionDocumentKind;
  upload: Omit<AdmissionDocumentInput, "kind"> | null;
  url: string | null | undefined;
};

export type AdmissionDocumentSubmissionCheck =
  | { ok: true; submission: AdmissionDocumentSubmission }
  | { ok: false; issue: AdmissionDocumentIssue };

/**
 * Setiap dokumen boleh dilengkapi dengan salah satu cara saja: unggah berkas
 * atau tautan. Mengirim keduanya sekaligus ditolak (tidak ada aturan diam-diam
 * soal mana yang menang), begitu pula tidak mengirim apa pun untuk dokumen wajib.
 */
export function checkAdmissionDocumentSubmission(
  input: AdmissionDocumentSubmissionInput,
): AdmissionDocumentSubmissionCheck {
  const { kind, upload } = input;
  const rawUrl = (input.url ?? "").trim();
  const hasUrl = rawUrl.length > 0;

  if (upload && hasUrl) {
    return { ok: false, issue: { kind, reason: "both" } };
  }

  if (upload) {
    const result = checkAdmissionDocument({ kind, ...upload });

    if (!result.ok) {
      return { ok: false, issue: result.issue };
    }

    return { ok: true, submission: { kind, mode: "upload", document: result.document } };
  }

  if (hasUrl) {
    const safe = safeDocumentUrl(rawUrl);

    if (!safe) {
      return { ok: false, issue: { kind, reason: "url" } };
    }

    return { ok: true, submission: { kind, mode: "url", url: safe } };
  }

  if (ADMISSION_DOCUMENT_REQUIRED[kind]) {
    return { ok: false, issue: { kind, reason: "required" } };
  }

  return { ok: true, submission: { kind, mode: "none" } };
}

/* ------------------------------ hak akses berkas ---------------------------- */

export type DocumentViewer = { id: string; roles: readonly Role[] };

// Berkas hanya boleh dibuka administrasi (peninjau PPDB) atau wali santri yang
// mengirim pendaftaran tersebut.
export function canAccessAdmissionDocument(viewer: DocumentViewer, admission: { submitterId: string | null }): boolean {
  if (hasPermission(viewer.roles, "admission.review")) return true;
  return admission.submitterId !== null && admission.submitterId === viewer.id;
}

/* ---------------------------- tampilan berkas ------------------------------ */

export type AdmissionDocumentView = {
  kind: AdmissionDocumentKind;
  label: string;
  required: boolean;
  // "upload" = berkas tersimpan di sistem, "link" = tautan luar, null = kosong.
  source: "upload" | "link" | null;
  href: string | null;
  filename: string | null;
  typeLabel: string | null;
  sizeLabel: string | null;
  isImage: boolean;
  linkLabel: string | null;
};

type AdmissionDocumentViewSource = {
  familyCardUrl: string | null;
  birthCertificateUrl: string | null;
  previousReportUrl: string | null;
  photoUrl: string | null;
  paymentProofUrl: string | null;
  documents: readonly { id: string; kind: AdmissionDocumentKind; filename: string; mimeType: string; size: number }[];
};

// Yang ditampilkan cukup nama host-nya; URL panjang (mis. tautan Google Drive)
// hanya memenuhi kartu berkas.
function linkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "tautan eksternal";
  }
}

/**
 * Tiga kemungkinan per jenis berkas: berkas terunggah, tautan (termasuk tautan
 * pendaftaran lama), atau belum ada sama sekali. Tautan divalidasi ulang di sini
 * agar nilai lama yang tidak aman tidak pernah dirender. Dipakai bersama oleh
 * tinjauan administrasi dan status pendaftaran wali santri.
 */
export function toAdmissionDocumentViews(admission: AdmissionDocumentViewSource): AdmissionDocumentView[] {
  return ADMISSION_DOCUMENT_KINDS.map((kind) => {
    const uploaded = admission.documents.find((doc) => doc.kind === kind);
    const linkUrl = uploaded ? null : safeDocumentUrl(admission[ADMISSION_DOCUMENT_URL_COLUMN[kind]]);

    return {
      kind,
      label: ADMISSION_DOCUMENT_LABEL[kind],
      required: ADMISSION_DOCUMENT_REQUIRED[kind],
      source: uploaded ? ("upload" as const) : linkUrl ? ("link" as const) : null,
      href: uploaded ? `/api/dokumen/${uploaded.id}` : linkUrl,
      filename: uploaded?.filename ?? null,
      typeLabel: uploaded ? mimeTypeLabel(uploaded.mimeType) : null,
      sizeLabel: uploaded ? formatFileSize(uploaded.size) : null,
      isImage: uploaded ? uploaded.mimeType.startsWith("image/") : false,
      linkLabel: linkUrl ? linkHostname(linkUrl) : null,
    };
  });
}

/* --------------------------------- loader ---------------------------------- */

export const getAdmissionsForReview = cache(async () => {
  const admissions = await prisma.admission.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      registrationCode: true,
      childName: true,
      level: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      previousSchool: true,
      parentName: true,
      parentPhone: true,
      parentEmail: true,
      address: true,
      note: true,
      reviewNote: true,
      createdStudentId: true,
      submitterId: true,
      familyCardUrl: true,
      birthCertificateUrl: true,
      previousReportUrl: true,
      photoUrl: true,
      paymentProofUrl: true,
      status: true,
      createdAt: true,
      documents: {
        select: { id: true, kind: true, filename: true, mimeType: true, size: true },
      },
    },
  });

  const studentIds = admissions.map((admission) => admission.createdStudentId).filter((id) => id !== null);
  const students = studentIds.length
    ? await prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, studentNumber: true },
      })
    : [];
  const studentNumberById = new Map(students.map((student) => [student.id, student.studentNumber]));

  return admissions.map((admission) => ({
    ...admission,
    studentNumber: admission.createdStudentId ? (studentNumberById.get(admission.createdStudentId) ?? null) : null,
    // Urutkan sesuai urutan formulir, bukan urutan penyimpanan.
    documents: ADMISSION_DOCUMENT_KINDS.map((kind) => admission.documents.find((doc) => doc.kind === kind)).filter(
      (doc) => doc !== undefined,
    ),
  }));
});

/**
 * Pendaftaran yang dikirim satu akun wali santri, untuk halaman status
 * pendaftaran. Selalu dibatasi `submitterId` supaya wali tidak pernah melihat
 * pengajuan wali lain; pendaftaran lama tanpa `submitterId` memang tidak muncul
 * karena pemiliknya tidak bisa dipastikan.
 */
export const getAdmissionsBySubmitter = cache(async (submitterId: string) => {
  const admissions = await prisma.admission.findMany({
    where: { submitterId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      registrationCode: true,
      childName: true,
      level: true,
      status: true,
      note: true,
      reviewNote: true,
      createdAt: true,
      reviewedAt: true,
      createdStudentId: true,
      familyCardUrl: true,
      birthCertificateUrl: true,
      previousReportUrl: true,
      photoUrl: true,
      paymentProofUrl: true,
      documents: {
        select: { id: true, kind: true, filename: true, mimeType: true, size: true },
      },
    },
  });

  // Tautan ke halaman anak hanya diberikan bila santri hasil penerimaan masih
  // ada dan memang tertaut ke akun wali ini, supaya tidak ada tautan mati.
  const createdStudentIds = admissions.map((a) => a.createdStudentId).filter((id) => id !== null);
  const linkedChildren = createdStudentIds.length
    ? await prisma.studentProfile.findMany({
        where: { id: { in: createdStudentIds }, parentId: submitterId },
        select: { id: true, studentNumber: true },
      })
    : [];
  const linkedChildById = new Map(linkedChildren.map((child) => [child.id, child]));

  return admissions.map((admission) => ({
    id: admission.id,
    registrationCode: admission.registrationCode,
    childName: admission.childName,
    level: admission.level,
    status: admission.status,
    note: admission.note,
    reviewNote: admission.reviewNote,
    createdAt: admission.createdAt,
    reviewedAt: admission.reviewedAt,
    childId: admission.createdStudentId && linkedChildById.has(admission.createdStudentId) ? admission.createdStudentId : null,
    studentNumber: admission.createdStudentId ? (linkedChildById.get(admission.createdStudentId)?.studentNumber ?? null) : null,
    documents: toAdmissionDocumentViews(admission),
  }));
});
