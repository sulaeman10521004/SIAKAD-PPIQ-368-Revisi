import { APP_NAME } from "@/lib/brand";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-ink">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-700">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-balance">Sedang offline</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2 text-pretty">
          {APP_NAME} butuh koneksi internet untuk memuat data terbaru. Periksa jaringan Anda, lalu coba lagi.
        </p>
      </div>
    </main>
  );
}
