import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "../generated/prisma/client";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi sebelum menjalankan seed.`);
  return value;
}

const connectionString = requiredEnvironment("DATABASE_URL");
const adminName = requiredEnvironment("SEED_ADMIN_NAME");
const adminEmail = requiredEnvironment("SEED_ADMIN_EMAIL").toLowerCase();
const adminPassword = requiredEnvironment("SEED_ADMIN_PASSWORD");
const adminPhone = process.env.SEED_ADMIN_PHONE?.trim() || null;

if (!/^\S+@\S+\.\S+$/.test(adminEmail)) {
  throw new Error("SEED_ADMIN_EMAIL harus berupa alamat email yang valid.");
}

if (adminPassword.length < 8) {
  throw new Error("SEED_ADMIN_PASSWORD minimal 8 karakter.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      phone: adminPhone,
      passwordHash,
      roles: [UserRole.ADMIN],
      status: UserStatus.VERIFIED,
      verifiedAt: new Date(),
      verifiedById: null,
    },
    create: {
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      roles: [UserRole.ADMIN],
      status: UserStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  console.log(`Seed selesai. Akun administrasi: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
