"use server";

import { redirect } from "next/navigation";
import { UserStatus } from "@/generated/prisma/client";
import { signInWithPassword } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const user = await signInWithPassword(email, password);

  if (!user) {
    redirect("/login?error=invalid");
  }

  if (user.status !== UserStatus.VERIFIED) {
    redirect("/pending");
  }

  redirect("/dashboard");
}
