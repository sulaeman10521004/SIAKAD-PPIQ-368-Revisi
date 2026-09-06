import { randomInt, randomUUID } from "node:crypto";
import type { EducationLevel } from "@/generated/prisma/client";

/** Kode proses PPDB, sengaja memiliki bentuk yang tidak dapat tertukar dengan NIS. */
export function createRegistrationCode(level: EducationLevel, now = new Date()): string {
  const serial = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `REG-${now.getFullYear()}-${level}-${serial}`;
}

/** NIS dibuat saat santri diterima. Angka jenjang: SD=1, SMP=2, SMA=3. */
export function createStudentNumber(level: EducationLevel, now = new Date()): string {
  const levelCode: Record<EducationLevel, string> = { SD: "1", SMP: "2", SMA: "3" };
  const serial = `${now.getTime().toString().slice(-7)}${randomInt(0, 100).toString().padStart(2, "0")}`;
  return `${now.getFullYear()}${levelCode[level]}${serial}`;
}
