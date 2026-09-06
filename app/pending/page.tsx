import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Icons } from "@/components/ui";

export default async function PendingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status === "VERIFIED") {
    redirect("/dashboard");
  }

  const statusText =
    {
      PENDING: "Akun kamu menunggu verifikasi admin.",
      REJECTED: "Akun kamu belum disetujui admin.",
      SUSPENDED: "Akun kamu sedang dinonaktifkan.",
    }[user.status] ?? "Akun kamu belum bisa mengakses sistem.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12 text-ink">
      <section className="w-full max-w-2xl rounded-[22px] border border-line bg-surface p-8 text-center shadow-float">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning-soft text-[oklch(0.48_0.12_75)]">
          <Icons.clock size={26} />
        </span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">Verifikasi admin</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Belum bisa mengakses sistem</h1>
        <p className="mt-4 text-ink-2">{statusText}</p>
        <p className="mono mt-3 text-sm text-ink-3">{user.email}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <form action="/logout" method="post">
            <button type="submit" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-600">
              Logout
            </button>
          </form>
          <Link href="/" className="rounded-full border border-line-strong px-5 py-3 text-sm font-semibold hover:bg-surface-2">
            Kembali ke beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
