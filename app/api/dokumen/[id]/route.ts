import { UserStatus } from "@/generated/prisma/client";
import { canAccessAdmissionDocument, isAdmissionDocumentMimeType } from "@/lib/admissions";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// 404 dipakai untuk semua penolakan (belum login, bukan pemilik, berkas tidak
// ada) supaya route ini tidak membocorkan keberadaan sebuah dokumen.
function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);

  if (!user || user.status !== UserStatus.VERIFIED) {
    return notFound();
  }

  const doc = await prisma.admissionDocument.findUnique({
    where: { id },
    select: {
      filename: true,
      mimeType: true,
      data: true,
      admission: { select: { submitterId: true } },
    },
  });

  if (!doc) {
    return notFound();
  }

  if (!canAccessAdmissionDocument({ id: user.id, roles: user.roles as Role[] }, doc.admission)) {
    return notFound();
  }

  // Pertahanan berlapis: hanya jpeg/png/pdf yang boleh keluar dari sini, agar
  // browser tidak pernah mengeksekusi berkas kiriman pengguna.
  if (!isAdmissionDocumentMimeType(doc.mimeType)) {
    return notFound();
  }

  const filename = doc.filename.replace(/["\\]/g, "");

  return new Response(doc.data, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.data.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
