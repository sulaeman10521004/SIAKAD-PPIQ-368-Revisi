"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NotificationType, ReportCardStatus, Semester, UserRole } from "@/generated/prisma/client";
import { requirePermission, type AuthUser } from "@/lib/auth";
import type { Period } from "@/lib/lms";
import { notifyUsers, notifyVerifiedRole } from "@/lib/notifications";
import { buildReportDraft, getStudentAdministration, outstandingAdministration } from "@/lib/rapor";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: boolean; message?: string };

const periodSchema = z.object({
  studentId: z.string().min(1),
  semester: z.enum(Semester),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
});

/** Status yang masih boleh disunting wali kelas. */
const EDITABLE: ReportCardStatus[] = [ReportCardStatus.DRAFT, ReportCardStatus.REJECTED];

function revalidateRapor() {
  revalidatePath("/rapor");
  revalidatePath("/anak");
}

/**
 * Wali kelas hanya boleh menyentuh rapor santri di kelas binaannya sendiri, dan
 * hanya untuk tahun ajaran kelas binaan itu — wali kelas tahun ini tidak boleh
 * mengutak-atik rapor tahun lalu yang wewenangnya ada pada wali kelas lain.
 */
function homeroomDenial(
  classRoom: { homeroomTeacherId: string | null; academicYear: string } | null | undefined,
  userId: string,
  academicYear: string,
): string | null {
  if (!classRoom || classRoom.homeroomTeacherId !== userId) {
    return "Anda bukan wali kelas santri ini.";
  }
  if (classRoom.academicYear !== academicYear) {
    return `Anda bukan wali kelas santri ini pada tahun ajaran ${academicYear}.`;
  }
  return null;
}

/** Dicek di server, bukan sekadar disembunyikan di UI. */
async function guardHomeroom(
  user: AuthUser,
  studentId: string,
  academicYear: string,
): Promise<{ error: string } | { student: StudentIdentity }> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      studentNumber: true,
      className: true,
      level: true,
      classRoom: { select: { homeroomTeacherId: true, academicYear: true } },
    },
  });
  if (!student) return { error: "Santri tidak ditemukan." };
  const denied = homeroomDenial(student.classRoom, user.id, academicYear);
  if (denied) return { error: denied };
  return { student };
}

type StudentIdentity = {
  name: string;
  studentNumber: string;
  className: string;
  level: string;
};

/**
 * Identitas santri dibekukan pada rapornya sendiri. Tanpa ini, mencetak ulang
 * rapor tahun lalu akan menampilkan kelas santri saat ini (mis. sudah naik kelas).
 */
function identitySnapshot(student: StudentIdentity) {
  return {
    studentNameSnapshot: student.name,
    studentNumberSnapshot: student.studentNumber,
    classNameSnapshot: student.className,
    levelSnapshot: student.level,
  };
}

async function loadCardForHomeroom(user: AuthUser, reportCardId: string) {
  if (!reportCardId) return { error: "Rapor tidak ditemukan." as const };

  const card = await prisma.reportCard.findUnique({
    where: { id: reportCardId },
    select: {
      id: true,
      status: true,
      studentId: true,
      semester: true,
      academicYear: true,
      student: { select: { name: true, classRoom: { select: { homeroomTeacherId: true, academicYear: true } } } },
    },
  });
  if (!card) return { error: "Rapor tidak ditemukan." as const };
  // Tahun ajaran rapor harus sama dengan tahun ajaran kelas binaan.
  const denied = homeroomDenial(card.student.classRoom, user.id, card.academicYear);
  if (denied) return { error: denied };
  return { card };
}

/* ------------------------- wali kelas: menyusun rapor ----------------------- */

/** Buat/hitung ulang rapor. Nilai sikap yang sudah diisi manual dipertahankan. */
export async function generateRaporAction(input: {
  studentId: string;
  semester: Semester;
  academicYear: string;
}): Promise<ActionResult> {
  const user = await requirePermission("report.manage");

  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data rapor tidak valid." };
  const { studentId, semester, academicYear } = parsed.data;

  const guarded = await guardHomeroom(user, studentId, academicYear);
  if ("error" in guarded) return { ok: false, message: guarded.error };
  const snapshot = identitySnapshot(guarded.student);

  const period: Period = { semester, academicYear };

  const existing = await prisma.reportCard.findUnique({
    where: { studentId_semester_academicYear: { studentId, semester, academicYear } },
    select: { id: true, status: true, behaviorEntries: { select: { criterionName: true, scoreValue: true } } },
  });

  if (existing && !EDITABLE.includes(existing.status)) {
    return {
      ok: false,
      message:
        existing.status === ReportCardStatus.PUBLISHED
          ? "Rapor sudah terbit dan tidak bisa dihitung ulang."
          : "Rapor sudah dikirim ke administrasi, tidak bisa dihitung ulang.",
    };
  }

  const draft = await buildReportDraft(studentId, period);
  if (draft.entries.length === 0) {
    return { ok: false, message: "Santri belum terdaftar di mata pelajaran mana pun." };
  }

  const keptScores = new Map(existing?.behaviorEntries.map((row) => [row.criterionName, row.scoreValue]) ?? []);
  const behaviorEntries = draft.behaviorEntries.map((row) => ({
    ...row,
    scoreValue: keptScores.get(row.criterionName) ?? row.scoreValue,
  }));

  if (existing) {
    await prisma.$transaction([
      prisma.reportCardEntry.deleteMany({ where: { reportCardId: existing.id } }),
      prisma.reportCardBehaviorEntry.deleteMany({ where: { reportCardId: existing.id } }),
      prisma.reportCardEntry.createMany({
        data: draft.entries.map((entry) => ({ ...entry, reportCardId: existing.id })),
      }),
      prisma.reportCardBehaviorEntry.createMany({
        data: behaviorEntries.map((entry) => ({ ...entry, reportCardId: existing.id })),
      }),
      prisma.reportCard.update({
        where: { id: existing.id },
        data: {
          createdById: user.id,
          status: ReportCardStatus.DRAFT,
          submittedAt: null,
          // Draf baru: jejak tinjauan administrasi sebelumnya tidak boleh tersisa.
          reviewedAt: null,
          reviewedById: null,
          adminNote: null,
          ...draft.recap,
          ...snapshot,
        },
      }),
    ]);
  } else {
    await prisma.reportCard.create({
      data: {
        studentId,
        semester,
        academicYear,
        createdById: user.id,
        ...draft.recap,
        ...snapshot,
        entries: { createMany: { data: draft.entries } },
        behaviorEntries: { createMany: { data: behaviorEntries } },
      },
    });
  }

  revalidateRapor();
  return { ok: true };
}

export async function saveHomeroomNoteAction(input: {
  reportCardId: string;
  note: string;
}): Promise<ActionResult> {
  const user = await requirePermission("report.manage");
  const loaded = await loadCardForHomeroom(user, input.reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };
  if (!EDITABLE.includes(loaded.card.status)) {
    return { ok: false, message: "Rapor sudah dikirim, catatan tidak bisa diubah." };
  }

  await prisma.reportCard.update({
    where: { id: loaded.card.id },
    data: { homeroomNote: input.note.trim() || null },
  });

  await notifyVerifiedRole(
    UserRole.ADMIN,
    {
      type: NotificationType.REPORT,
      title: "Rapor menunggu pemeriksaan",
      message: `Rapor ${loaded.card.student.name} semester ${loaded.card.semester === "GANJIL" ? "Ganjil" : "Genap"} tahun ajaran ${loaded.card.academicYear} telah dikirim oleh wali kelas.`,
      href: `/rapor/${loaded.card.id}`,
    },
    user.id,
  );

  revalidateRapor();
  return { ok: true };
}

/** Simpan nilai sikap & kedisiplinan yang diisi manual wali kelas. */
export async function saveBehaviorScoresAction(input: {
  reportCardId: string;
  scores: { id: string; scoreValue: number }[];
}): Promise<ActionResult> {
  const user = await requirePermission("report.manage");
  const loaded = await loadCardForHomeroom(user, input.reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };
  if (!EDITABLE.includes(loaded.card.status)) {
    return { ok: false, message: "Rapor sudah dikirim, nilai sikap tidak bisa diubah." };
  }

  const rows = await prisma.reportCardBehaviorEntry.findMany({
    where: { reportCardId: loaded.card.id },
    select: { id: true, maxScore: true },
  });
  const maxById = new Map(rows.map((row) => [row.id, row.maxScore]));

  const updates: { id: string; scoreValue: number }[] = [];
  for (const score of input.scores) {
    const max = maxById.get(score.id);
    if (max === undefined) continue;
    const value = Math.round(Number(score.scoreValue));
    if (!Number.isFinite(value) || value < 0 || value > max) {
      return { ok: false, message: `Nilai sikap harus antara 0 dan ${max}.` };
    }
    updates.push({ id: score.id, scoreValue: value });
  }

  await prisma.$transaction(
    updates.map((row) =>
      prisma.reportCardBehaviorEntry.update({ where: { id: row.id }, data: { scoreValue: row.scoreValue } }),
    ),
  );
  revalidateRapor();
  return { ok: true };
}

/** DRAFT/REJECTED -> SUBMITTED. Setelah ini wali kelas tidak bisa menyunting. */
export async function submitRaporAction(reportCardId: string): Promise<ActionResult> {
  const user = await requirePermission("report.manage");
  const loaded = await loadCardForHomeroom(user, reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };
  if (!EDITABLE.includes(loaded.card.status)) {
    return { ok: false, message: "Rapor ini sudah dikirim ke administrasi." };
  }

  await prisma.reportCard.update({
    where: { id: loaded.card.id },
    data: {
      status: ReportCardStatus.SUBMITTED,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedById: null,
      adminNote: null,
    },
  });

  revalidateRapor();
  return { ok: true };
}

/** Hanya rapor yang belum dikirim (atau dikembalikan) yang boleh dihapus. */
export async function deleteRaporAction(reportCardId: string): Promise<ActionResult> {
  const user = await requirePermission("report.manage");
  const loaded = await loadCardForHomeroom(user, reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };
  if (!EDITABLE.includes(loaded.card.status)) {
    return { ok: false, message: "Rapor yang sudah dikirim atau terbit tidak bisa dihapus." };
  }

  await prisma.reportCard.delete({ where: { id: loaded.card.id } });
  revalidateRapor();
  return { ok: true };
}

/* --------------------------- administrasi: ACC/tolak ------------------------ */

async function loadCardForReview(reportCardId: string) {
  if (!reportCardId) return { error: "Rapor tidak ditemukan." as const };

  const card = await prisma.reportCard.findUnique({
    where: { id: reportCardId },
    select: {
      id: true,
      status: true,
      studentId: true,
      semester: true,
      academicYear: true,
      createdById: true,
      student: {
        select: {
          name: true,
          parentId: true,
          classRoom: { select: { homeroomTeacherId: true } },
        },
      },
    },
  });
  if (!card) return { error: "Rapor tidak ditemukan." as const };
  return { card };
}

/**
 * Palang administrasi: rapor tidak boleh di-ACC selama masih ada item
 * administrasi aktif yang belum terpenuhi pada periode tersebut.
 */
async function administrationBlock(studentId: string, period: Period): Promise<string | null> {
  const items = await getStudentAdministration(studentId, period);
  const outstanding = outstandingAdministration(items);
  if (outstanding.length === 0) return null;
  return `Administrasi belum lunas: ${outstanding.join(", ")}. Rapor tidak bisa di-ACC.`;
}

/** SUBMITTED -> APPROVED. Penerbitan tetap butuh langkah "Terbitkan" terpisah. */
export async function approveRaporAction(input: {
  reportCardId: string;
  adminNote?: string;
}): Promise<ActionResult> {
  const user = await requirePermission("report.approve");
  const loaded = await loadCardForReview(input.reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };

  const { card } = loaded;
  if (card.status !== ReportCardStatus.SUBMITTED) {
    return { ok: false, message: "Hanya rapor berstatus Menunggu ACC yang bisa di-ACC." };
  }

  const blocked = await administrationBlock(card.studentId, {
    semester: card.semester,
    academicYear: card.academicYear,
  });
  if (blocked) return { ok: false, message: blocked };

  await prisma.reportCard.update({
    where: { id: card.id },
    data: {
      status: ReportCardStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: user.id,
      adminNote: input.adminNote?.trim() || null,
    },
  });

  const homeroomId = card.createdById ?? card.student.classRoom?.homeroomTeacherId;
  if (homeroomId) {
    await notifyUsers(
      [homeroomId],
      {
        type: NotificationType.REPORT,
        title: "Rapor disetujui",
        message: `Rapor ${card.student.name} sudah di-ACC administrasi dan siap diterbitkan.`,
        href: `/rapor/${card.id}`,
      },
      user.id,
    );
  }

  revalidateRapor();
  return { ok: true };
}

/** SUBMITTED -> REJECTED. Alasan wajib agar wali kelas tahu yang harus dibenahi. */
export async function rejectRaporAction(input: {
  reportCardId: string;
  adminNote: string;
}): Promise<ActionResult> {
  const user = await requirePermission("report.approve");
  const note = input.adminNote?.trim() ?? "";
  if (note.length < 3) return { ok: false, message: "Tuliskan alasan pengembalian rapor." };

  const loaded = await loadCardForReview(input.reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };
  if (loaded.card.status !== ReportCardStatus.SUBMITTED) {
    return { ok: false, message: "Hanya rapor berstatus Menunggu ACC yang bisa dikembalikan." };
  }

  await prisma.reportCard.update({
    where: { id: loaded.card.id },
    data: {
      status: ReportCardStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: user.id,
      adminNote: note,
    },
  });

  const homeroomId = loaded.card.createdById ?? loaded.card.student.classRoom?.homeroomTeacherId;
  if (homeroomId) {
    await notifyUsers(
      [homeroomId],
      {
        type: NotificationType.REPORT,
        title: "Rapor dikembalikan",
        message: `Rapor ${loaded.card.student.name} perlu diperbaiki. Catatan administrasi: ${note}`,
        href: `/rapor/${loaded.card.id}`,
      },
      user.id,
    );
  }

  revalidateRapor();
  return { ok: true };
}

/** APPROVED -> PUBLISHED. Setelah terbit rapor tidak bisa diubah lagi. */
export async function publishRaporAction(reportCardId: string): Promise<ActionResult> {
  const user = await requirePermission("report.distribute");
  const loaded = await loadCardForReview(reportCardId);
  if ("error" in loaded) return { ok: false, message: loaded.error };

  const { card } = loaded;
  if (card.status === ReportCardStatus.PUBLISHED) return { ok: false, message: "Rapor sudah terbit." };
  if (card.status !== ReportCardStatus.APPROVED) {
    return { ok: false, message: "Rapor harus di-ACC administrasi sebelum diterbitkan." };
  }

  // Palang administrasi dicek ulang: status bisa berubah setelah ACC.
  const blocked = await administrationBlock(card.studentId, {
    semester: card.semester,
    academicYear: card.academicYear,
  });
  if (blocked) return { ok: false, message: blocked };

  await prisma.reportCard.update({
    where: { id: card.id },
    data: { status: ReportCardStatus.PUBLISHED, publishedAt: new Date() },
  });

  if (card.student.parentId) {
    await notifyUsers(
      [card.student.parentId],
      {
        type: NotificationType.REPORT,
        title: "Rapor telah diterbitkan",
        message: `Rapor ${card.student.name} semester ${card.semester === "GANJIL" ? "Ganjil" : "Genap"} tahun ajaran ${card.academicYear} sudah dapat dilihat.`,
        href: `/anak/${card.studentId}`,
      },
      user.id,
    );
  }

  revalidateRapor();
  return { ok: true };
}
