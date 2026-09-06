"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { EducationLevel, NotificationType, UserRole } from "@/generated/prisma/client";
import {
  ADMISSION_DOCUMENT_FIELD,
  ADMISSION_DOCUMENT_KINDS,
  ADMISSION_DOCUMENT_URL_COLUMN,
  ADMISSION_DOCUMENT_URL_FIELD,
  checkAdmissionDocumentSubmission,
  parseAdmissionBirthDate,
  type AdmissionDocumentIssue,
  type AdmissionDocumentUpload,
} from "@/lib/admissions";
import { requirePermission } from "@/lib/auth";
import { createRegistrationCode } from "@/lib/identifiers";
import { notifyVerifiedRole } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  childName: z.string().trim().min(2, "Nama santri wajib diisi."),
  level: z.enum(["SD", "SMP", "SMA"]),
  gender: z.string().trim().optional(),
  birthPlace: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  previousSchool: z.string().trim().optional(),
  address: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

type AdmissionUrlColumn = (typeof ADMISSION_DOCUMENT_URL_COLUMN)[keyof typeof ADMISSION_DOCUMENT_URL_COLUMN];

function rejectDocument(issue: AdmissionDocumentIssue): never {
  redirect(`/pendaftaran?error=${issue.reason}&doc=${issue.kind}`);
}

export async function submitAdmissionAction(formData: FormData) {
  const parent = await requirePermission("admission.submit");
  const parsed = schema.safeParse({
    childName: formData.get("childName"),
    level: formData.get("level"),
    gender: formData.get("gender"),
    birthPlace: formData.get("birthPlace"),
    birthDate: formData.get("birthDate"),
    previousSchool: formData.get("previousSchool"),
    address: formData.get("address"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    redirect("/pendaftaran?error=invalid");
  }

  // Diperiksa sebelum berkas dibaca: percuma memuat unggahan berukuran besar
  // kalau data teksnya sudah pasti ditolak.
  const birthDate = parseAdmissionBirthDate(parsed.data.birthDate);
  if (!birthDate.ok) {
    redirect(`/pendaftaran?error=${birthDate.reason}`);
  }

  // Setiap dokumen boleh dilengkapi dengan unggahan berkas atau tautan, dan
  // semuanya diperiksa lebih dulu: pendaftaran tidak boleh tersimpan separuh
  // jalan kalau salah satu dokumen ditolak.
  const documents: AdmissionDocumentUpload[] = [];
  const documentUrls: Partial<Record<AdmissionUrlColumn, string>> = {};

  for (const kind of ADMISSION_DOCUMENT_KINDS) {
    const value = formData.get(ADMISSION_DOCUMENT_FIELD[kind]);
    const file = value instanceof File && value.size > 0 ? value : null;
    const url = formData.get(ADMISSION_DOCUMENT_URL_FIELD[kind]);

    const result = checkAdmissionDocumentSubmission({
      kind,
      upload: file
        ? {
            filename: file.name,
            declaredMimeType: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          }
        : null,
      url: typeof url === "string" ? url : null,
    });

    if (!result.ok) {
      rejectDocument(result.issue);
    }

    if (result.submission.mode === "upload") {
      documents.push(result.submission.document);
    } else if (result.submission.mode === "url") {
      documentUrls[ADMISSION_DOCUMENT_URL_COLUMN[kind]] = result.submission.url;
    }
  }

  const d = parsed.data;
  const registrationCode = createRegistrationCode(d.level as EducationLevel);
  await prisma.$transaction(async (tx) => {
    const admission = await tx.admission.create({
      data: {
        childName: d.childName,
        registrationCode,
        level: d.level as EducationLevel,
        gender: d.gender || null,
        birthPlace: d.birthPlace || null,
        birthDate: birthDate.value,
        previousSchool: d.previousSchool || null,
        parentName: parent.name,
        parentPhone: parent.phone ?? "-",
        parentEmail: parent.email.toLowerCase(),
        address: d.address || null,
        note: d.note || null,
        submitterId: parent.id,
        // Dokumen yang dilengkapi lewat tautan disimpan pada kolom URL-nya
        // masing-masing; yang diunggah menjadi baris AdmissionDocument.
        ...documentUrls,
      },
      select: { id: true },
    });

    if (documents.length > 0) {
      await tx.admissionDocument.createMany({
        data: documents.map((doc) => ({
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

  await notifyVerifiedRole(UserRole.ADMIN, {
    type: NotificationType.ADMISSION,
    title: "Pendaftaran baru",
    message: `${parent.name} mengirim pendaftaran ${d.childName} (${registrationCode}) untuk jenjang ${d.level}.`,
    href: "/penerimaan",
  });

  redirect(`/pendaftaran?success=1&code=${registrationCode}`);
}
