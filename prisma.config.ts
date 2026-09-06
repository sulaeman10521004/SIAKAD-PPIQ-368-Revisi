import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: requireDatabaseUrl(),
  },
});

// Sebelumnya nilai ini jatuh diam-diam ke localhost saat DATABASE_URL kosong,
// sehingga env var yang belum diset menyamar sebagai "database mati" (P1001)
// di lingkungan yang sama sekali tidak punya Postgres lokal, seperti CI/Vercel.
function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL belum diset. Prisma tidak punya nilai bawaan yang aman di sini — " +
        "isi variabel ini di .env untuk pengembangan lokal, atau di Environment Variables " +
        "proyek Vercel (Production dan Preview) sebelum menjalankan migrasi.",
    );
  }

  return url;
}
