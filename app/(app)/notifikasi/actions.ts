"use server";

import { revalidatePath } from "next/cache";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: boolean; message?: string };

function revalidateNotifications() {
  revalidatePath("/", "layout");
  revalidatePath("/notifikasi");
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await requireVerifiedUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
  return { ok: true };
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const user = await requireVerifiedUser();
  if (!notificationId) return { ok: false, message: "Notifikasi tidak ditemukan." };

  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
  return result.count > 0
    ? { ok: true }
    : { ok: false, message: "Notifikasi tidak ditemukan atau sudah dibaca." };
}
