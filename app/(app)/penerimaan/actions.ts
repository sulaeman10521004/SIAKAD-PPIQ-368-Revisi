"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AdmissionStatus, EducationLevel, type AdmissionDocumentKind } from "@/generated/prisma/client";
import {
  ADMISSION_BIRTH_DATE_MESSAGE,
  ADMISSION_DOCUMENT_FIELD,
  ADMISSION_DOCUMENT_KINDS,
  ADMISSION_DOCUMENT_URL_COLUMN,
  ADMISSION_DOCUMENT_URL_FIELD,
  admissionDocumentIssueMessage,
  checkAdmissionDocument,
  parseAdmissionBirthDate,
  safeDocumentUrl,
  type AdmissionDocumentUpload,
} from "@/lib/admissions";
import { requirePermission } from "@/lib/auth";
import { createRegistrationCode } from "@/lib/identifiers";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: boolean; message?: string };

type AdmissionUrlColumn = (typeof ADMISSION_DOCUMENT_URL_COLUMN)[keyof typeof ADMISSION_DOCUMENT_URL_COLUMN];

/**
 * Pendaftaran yang diisikan administrasi (pendaftar datang langsung ke pondok)
 * memuat data wali secara manual -- berbeda dengan formulir wali santri yang
 * mengambilnya dari akun login. Berkas pendukung boleh menyusul, karena
 * administrasi biasanya memegang salinan fisiknya lebih dulu; kelengkapannya
 * tetap terlihat sebagai lencana "Berkas wajib belum lengkap" di daftar.
 */
const schema = z.object({
  childName: z.string().trim().min(2, "Nama santri wajib diisi."),
  level: z.enum(["SD", "SMP", "SMA"], { message: "Pilih jenjang santri." }),
  gender: z.string().trim().optional(),
  birthPlace: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  previousSchool: z.string().trim().optional(),
  parentName: z.string().trim().min(2, "Nama wali wajib diisi."),
  parentPhone: z.string().trim().min(6, "Nomor telepon wali wajib diisi."),
  parentEmail: z.string().trim().email("Email wali tidak valid."),
  address: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

type AdmissionFields = z.infer<typeof schema>;

function readFields(formData: FormData) {
  return schema.safeParse({
    childName: formData.get("childName"),
    level: formData.get("level"),
    gender: formData.get("gender"),
    birthPlace: formData.get("birthPlace"),
    birthDate: formData.get("birthDate"),
    previousSchool: formData.get("previousSchool"),
    parentName: formData.get("parentName"),
    parentPhone: formData.get("parentPhone"),
    parentEmail: formData.get("parentEmail"),
    address: formData.get("address"),
    note: formData.get("note"),
  });
}

function toAdmissionData(fields: AdmissionFields, birthDate: Date | null) {
  return {
    childName: fields.childName,
    level: fields.level as EducationLevel,
    gender: fields.gender || null,
    birthPlace: fields.birthPlace || null,
    birthDate,
    previousSchool: fields.previousSchool || null,
    parentName: fields.parentName,
    parentPhone: fields.parentPhone,
    parentEmail: fields.parentEmail.toLowerCase(),
    address: fields.address || null,
    note: fields.note || null,
  };
}

/* ------------------------------ berkas per jenis ---------------------------- */

/**
 * Rencana per jenis berkas yang dipilih administrasi lewat formulir:
 * "keep" membiarkan berkas/tautan yang sudah ada, "clear" mengosongkannya,
 * sedangkan "upload"/"url" menggantinya. Memilih mode tanpa mengisi apa pun
 * disamakan dengan "keep" supaya sekadar menekan tombol mode tidak menghapus
 * berkas yang sudah tersimpan.
 */
type DocumentPlan =
  | { kind: AdmissionDocumentKind; action: "keep" }
  | { kind: AdmissionDocumentKind; action: "clear" }
  | { kind: AdmissionDocumentKind; action: "upload"; document: AdmissionDocumentUpload }
  | { kind: AdmissionDocumentKind; action: "url"; url: string };

type DocumentPlanResult = { ok: true; plans: DocumentPlan[] } | { ok: false; message: string };

async function readDocumentPlans(formData: FormData): Promise<DocumentPlanResult> {
  const plans: DocumentPlan[] = [];

  for (const kind of ADMISSION_DOCUMENT_KINDS) {
    const mode = String(formData.get(`doc_${kind}_mode`) ?? "keep");

    if (mode === "clear") {
      plans.push({ kind, action: "clear" });
      continue;
    }

    if (mode === "upload") {
      const value = formData.get(ADMISSION_DOCUMENT_FIELD[kind]);
      const file = value instanceof File && value.size > 0 ? value : null;

      if (!file) {
        plans.push({ kind, action: "keep" });
        continue;
      }

      const result = checkAdmissionDocument({
        kind,
        filename: file.name,
        declaredMimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });

      if (!result.ok) {
        return { ok: false, message: admissionDocumentIssueMessage(result.issue) };
      }

      plans.push({ kind, action: "upload", document: result.document });
      continue;
    }

    if (mode === "url") {
      const raw = String(formData.get(ADMISSION_DOCUMENT_URL_FIELD[kind]) ?? "").trim();

      if (!raw) {
        plans.push({ kind, action: "keep" });
        continue;
      }

      const url = safeDocumentUrl(raw);

      if (!url) {
        return { ok: false, message: admissionDocumentIssueMessage({ kind, reason: "url" }) };
      }

      plans.push({ kind, action: "url", url });
      continue;
    }

    plans.push({ kind, action: "keep" });
  }

  return { ok: true, plans };
}

/** Kolom URL yang ikut berubah karena rencana berkas di atas. */
function urlColumnUpdates(plans: readonly DocumentPlan[]): Partial<Record<AdmissionUrlColumn, string | null>> {
  const updates: Partial<Record<AdmissionUrlColumn, string | null>> = {};

  for (const plan of plans) {
    const column = ADMISSION_DOCUMENT_URL_COLUMN[plan.kind];
    // "upload" ikut mengosongkan kolom URL: satu jenis berkas hanya boleh
    // terisi lewat satu jalur (lihat lib/admissions.ts).
    if (plan.action === "url") updates[column] = plan.url;
    else if (plan.action === "clear" || plan.action === "upload") updates[column] = null;
  }

  return updates;
}

function replacedKinds(plans: readonly DocumentPlan[]): AdmissionDocumentKind[] {
  return plans.filter((p) => p.action !== "keep").map((p) => p.kind);
}

function uploads(plans: readonly DocumentPlan[]): AdmissionDocumentUpload[] {
  return plans.flatMap((p) => (p.action === "upload" ? [p.document] : []));
}

/* --------------------------------- create ---------------------------------- */

export async function createAdmissionAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("admission.review");

  const parsed = readFields(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Periksa kembali data pendaftaran." };
  }

  const birthDate = parseAdmissionBirthDate(parsed.data.birthDate);
  if (!birthDate.ok) {
    return { ok: false, message: ADMISSION_BIRTH_DATE_MESSAGE[birthDate.reason] };
  }

  const documents = await readDocumentPlans(formData);
  if (!documents.ok) {
    return { ok: false, message: documents.message };
  }

  await prisma.$transaction(async (tx) => {
    const admission = await tx.admission.create({
      data: {
        ...toAdmissionData(parsed.data, birthDate.value),
        registrationCode: createRegistrationCode(parsed.data.level as EducationLevel),
        status: AdmissionStatus.PENDING,
        // submitterId sengaja null: pendaftaran ini tidak berasal dari akun wali
        // mana pun. Penerimaan nanti tetap menautkan/membuat akun wali lewat email.
        ...urlColumnUpdates(documents.plans),
      },
      select: { id: true },
    });

    const files = uploads(documents.plans);
    if (files.length > 0) {
      await tx.admissionDocument.createMany({
        data: files.map((doc) => ({
          admissionId: admission.id,
          kind: doc.kind,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          data: doc.data,
        })),
      });
    }
  });

  revalidatePath("/penerimaan");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* --------------------------------- update ---------------------------------- */

export async function updateAdmissionAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("admission.review");

  const admissionId = String(formData.get("admissionId") ?? "");
  const existing = admissionId
    ? await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, status: true } })
    : null;

  if (!existing) return { ok: false, message: "Pendaftaran tidak ditemukan." };
  // Pendaftaran yang sudah diputuskan ikut menjadi dasar akun wali dan data
  // santri yang terlanjur dibuat, jadi datanya dikunci setelah ditinjau.
  if (existing.status !== AdmissionStatus.PENDING) {
    return { ok: false, message: "Pendaftaran yang sudah diproses tidak bisa diubah." };
  }

  const parsed = readFields(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Periksa kembali data pendaftaran." };
  }

  const birthDate = parseAdmissionBirthDate(parsed.data.birthDate);
  if (!birthDate.ok) {
    return { ok: false, message: ADMISSION_BIRTH_DATE_MESSAGE[birthDate.reason] };
  }

  const documents = await readDocumentPlans(formData);
  if (!documents.ok) {
    return { ok: false, message: documents.message };
  }

  const changed = replacedKinds(documents.plans);
  const files = uploads(documents.plans);

  await prisma.$transaction(async (tx) => {
    await tx.admission.update({
      where: { id: existing.id },
      data: {
        ...toAdmissionData(parsed.data, birthDate.value),
        ...urlColumnUpdates(documents.plans),
      },
    });

    // Berkas lama dibuang lebih dulu supaya @@unique([admissionId, kind]) tidak
    // bentrok saat penggantinya ditulis.
    if (changed.length > 0) {
      await tx.admissionDocument.deleteMany({ where: { admissionId: existing.id, kind: { in: changed } } });
    }

    if (files.length > 0) {
      await tx.admissionDocument.createMany({
        data: files.map((doc) => ({
          admissionId: existing.id,
          kind: doc.kind,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          data: doc.data,
        })),
      });
    }
  });

  revalidatePath("/penerimaan");
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* --------------------------------- delete ---------------------------------- */

export async function deleteAdmissionAction(admissionId: string): Promise<ActionResult> {
  await requirePermission("admission.review");

  const admission = admissionId
    ? await prisma.admission.findUnique({
        where: { id: admissionId },
        select: { id: true, status: true, createdStudentId: true },
      })
    : null;

  if (!admission) return { ok: false, message: "Pendaftaran tidak ditemukan." };

  // Menghapus pendaftaran yang sudah menghasilkan data santri akan memutus
  // jejak asal santri tersebut; hapus santrinya lebih dulu bila memang salah.
  if (admission.status === AdmissionStatus.ACCEPTED && admission.createdStudentId) {
    return {
      ok: false,
      message: "Pendaftaran ini sudah diterima dan menghasilkan data santri. Hapus data santrinya lebih dulu.",
    };
  }

  // Berkas unggahan ikut terhapus lewat onDelete: Cascade pada AdmissionDocument.
  await prisma.admission.delete({ where: { id: admission.id } });

  revalidatePath("/penerimaan");
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return { ok: true };
}
