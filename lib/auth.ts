import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission, permissionsFor, type Permission, type Role } from "@/lib/permissions";

export const SESSION_COOKIE = "general_lms_session";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  status: UserStatus;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  await setSessionCookie(token, expiresAt);
}

export async function signInWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, passwordHash: true, roles: true, status: true },
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  await createUserSession(user.id);

  return { id: user.id, roles: user.roles, status: user.status };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, phone: true, roles: true, status: true },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireVerifiedUser() {
  const user = await requireUser();

  if (user.status !== UserStatus.VERIFIED) {
    redirect("/pending");
  }

  return user;
}

export function userPermissions(user: AuthUser): Set<Permission> {
  return permissionsFor(user.roles as Role[]);
}

export function userCan(user: AuthUser, permission: Permission): boolean {
  return hasPermission(user.roles as Role[], permission);
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireVerifiedUser();

  if (!userCan(user, permission)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireAnyPermission(permissions: readonly Permission[]): Promise<AuthUser> {
  const user = await requireVerifiedUser();

  if (!hasAnyPermission(user.roles as Role[], permissions)) {
    redirect("/dashboard");
  }

  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}
