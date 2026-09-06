"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { createUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6),
  password: z.string().min(6),
});

export async function registerParentAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/register?error=invalid");

  const data = parsed.data;
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) redirect("/register?error=email");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      phone: data.phone,
      passwordHash,
      roles: [UserRole.PARENT],
      status: UserStatus.VERIFIED,
      verifiedAt: new Date(),
    },
    select: { id: true },
  });

  await createUserSession(user.id);
  redirect("/pendaftaran");
}
