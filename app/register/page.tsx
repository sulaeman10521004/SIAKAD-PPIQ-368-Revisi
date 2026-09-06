import Link from "next/link";
import { redirect } from "next/navigation";
import { inputClasses } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { registerParentAction } from "./actions";

type RegisterPageProps = { searchParams: Promise<{ error?: string }> };

const errorMessages: Record<string, string> = {
  invalid: "Lengkapi nama, email, nomor HP, dan password minimal 6 karakter.",
  email: "Email sudah terdaftar. Silakan login untuk mendaftarkan anak.",
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect("/dashboard");

  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <AuthShell
      eyebrow="Pendaftaran wali santri"
      title="Buat akun wali, lalu daftarkan anak."
      description="Satu akun dapat digunakan untuk mendaftarkan dan memantau beberapa anak pada jenjang SD, SMP, maupun SMA."
      asideFooter={
        <ol className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-xs text-white/70">
          <li><strong className="block text-white">01</strong><span className="mt-1 block">Buat akun wali</span></li>
          <li><strong className="block text-white">02</strong><span className="mt-1 block">Isi data anak</span></li>
          <li><strong className="block text-white">03</strong><span className="mt-1 block">Pantau verifikasi</span></li>
        </ol>
      }
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Akun baru</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Daftar akun wali</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-ink-3">Gunakan email aktif untuk masuk dan memantau proses pendaftaran anak.</p>

      {errorMessage ? (
        <div className="mt-6 rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-semibold text-danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <form action={registerParentAction} className="mt-8 grid gap-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">Nama wali *</span>
          <input name="name" required autoComplete="name" className={inputClasses} placeholder="Nama lengkap wali" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">Email *</span>
          <input name="email" type="email" required autoComplete="email" className={inputClasses} placeholder="nama@email.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">Nomor HP *</span>
          <input name="phone" type="tel" required autoComplete="tel" className={inputClasses} placeholder="08xxxxxxxxxx" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">Password *</span>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputClasses} placeholder="Minimal 6 karakter" />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
        >
          Buat akun dan lanjutkan
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-3">
        Sudah punya akun wali?{" "}
        <Link href="/login" className="font-semibold text-primary-700 underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
