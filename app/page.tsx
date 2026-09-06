import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Icons, type IconKey } from "@/components/ui";
import { APP_NAME, APP_TAGLINE, LEVEL_FULL, LEVELS } from "@/lib/brand";

const highlights = [
  "Pantau nilai dan kehadiran anak secara berkala",
  "Satu akun wali dapat terhubung ke beberapa anak",
] as const;

const coreFeatures = [
  {
    number: "01",
    title: "Pendaftaran santri",
    description: "Wali membuat akun, mendaftarkan anak, dan memantau proses verifikasi secara online.",
    icon: "doc",
  },
  {
    number: "02",
    title: "Absensi santri",
    description: "Kehadiran dicatat per sesi pelajaran dan dapat dipantau kembali oleh wali.",
    icon: "check2",
  },
  {
    number: "03",
    title: "Jadwal pelajaran",
    description: "Jadwal disusun per jenjang agar kelas, ustadz, ruang, dan waktu tetap terarah.",
    icon: "calendar",
  },
  {
    number: "04",
    title: "Nilai harian",
    description: "Ustadz mengelola nilai mapel yang diampu, sementara wali melihat perkembangan anak.",
    icon: "chart",
  },
  {
    number: "05",
    title: "Rapor semester",
    description: "Wali kelas menyusun dan menerbitkan rapor yang tersimpan sebagai catatan semester.",
    icon: "award",
  },
  {
    number: "06",
    title: "Absensi ustadz dan BKKH",
    description: "Kehadiran serta laporan kegiatan harian ustadz dicatat berdasarkan rentang waktu.",
    icon: "clock",
  },
] satisfies { number: string; title: string; description: string; icon: IconKey }[];

const roles = [
  {
    name: "Wali santri",
    code: "WALI",
    description: "Mendaftarkan anak serta memantau jadwal, absensi, nilai, dan rapor yang sudah diterbitkan.",
  },
  {
    name: "Ustadz",
    code: "TEACHER",
    description: "Mengisi nilai dan absensi hanya untuk mata pelajaran yang diampu, lalu melengkapi absensi serta BKKH pribadi.",
  },
  {
    name: "Wali Kelas",
    code: "HOMEROOM",
    description: "Memantau kelas binaan dan mengelola catatan hingga penerbitan rapor semester.",
  },
  {
    name: "Administrasi",
    code: "ADMIN",
    description: "Mengelola PPDB, akun, administrasi santri, serta ACC dan penyerahan rapor.",
  },
  {
    name: "Mudir Ma'had",
    code: "MUDIR",
    description: "Mengelola kelas, mata pelajaran, penugasan ustadz, jadwal, dan kelompok penilaian, serta mengawasi kehadiran dan hasil akademik ustadz.",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Wali membuat akun",
    description: "Buat satu akun wali, lalu daftarkan satu atau beberapa anak dari ponsel.",
  },
  {
    number: "02",
    title: "Pesantren mengelola data",
    description: "Administrasi memverifikasi pendaftaran, sedangkan ustadz mengisi kegiatan akademik harian.",
  },
  {
    number: "03",
    title: "Perkembangan dipantau",
    description: "Wali melihat perkembangan anak dan Mudir mengawasi pelaksanaan tugas ustadz.",
  },
] as const;

export default async function Home() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/pendaftaran" : "/register";
  const primaryLabel = user ? "Daftarkan Anak" : "Buat Akun Wali";
  const dashboardHref = user ? "/dashboard" : "/login";
  const dashboardLabel = user ? "Buka Dashboard" : "Masuk";

  return (
    <main className="min-h-screen bg-bg text-ink">
      <section className="border-b border-line">
        <div className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-5 sm:px-6">
          <nav className="flex min-h-20 items-center justify-between gap-5" aria-label="Navigasi utama">
            <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <img src="/icons/logo-mark.png" alt="" className="h-9 w-9 rounded-xl" />
              <span className="text-base font-extrabold tracking-tight sm:text-lg">{APP_NAME}</span>
            </Link>

            <div className="hidden items-center gap-7 md:flex">
              <a href="#fitur" className="text-sm font-semibold text-ink-2 transition-colors hover:text-primary">Fitur</a>
              <a href="#peran" className="text-sm font-semibold text-ink-2 transition-colors hover:text-primary">Peran</a>
              <a href="#alur" className="text-sm font-semibold text-ink-2 transition-colors hover:text-primary">Cara kerja</a>
            </div>

            <Link
              href={dashboardHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink transition hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {dashboardLabel}
            </Link>
          </nav>

          <div className="grid flex-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
            <div>
              <p className="mb-5 inline-flex rounded-full bg-primary-soft px-4 py-2 text-sm font-semibold text-primary-700">
                {APP_TAGLINE}
              </p>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[58px]">
                Hubungkan pesantren dengan wali santri.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-ink-2 text-pretty sm:text-lg sm:leading-8">
                Satu aplikasi untuk pendaftaran, kegiatan akademik, pemantauan anak, serta pengawasan ustadz. Setiap pengguna
                mendapatkan akses sesuai tanggung jawabnya.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 text-center font-bold text-white transition hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
                >
                  {primaryLabel}
                </Link>
                <a
                  href="#tentang"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold text-ink-2 transition hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Pelajari aplikasinya <Icons.arrowDown size={17} />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {LEVELS.map((level) => (
                  <span key={level} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-2">
                    <span className="grid h-5 w-5 place-items-center rounded bg-primary-soft text-[11px] text-primary-700">{level}</span>
                    {LEVEL_FULL[level]}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-pop">
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Di dalam satu portal</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">Data penting tetap terhubung</h2>
                <div className="mt-5 divide-y divide-line border-y border-line">
                  {highlights.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 py-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-700">
                        <Icons.check2 size={17} />
                      </span>
                      <p className="text-sm font-semibold leading-6 text-ink">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-primary-700 p-5 text-white sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">Pondok Pesantren Integritas Qur&apos;ani 368</p>
                    <p className="mt-1 text-xs text-white/65">Jl. Ciwaruga, Parongpong, Kabupaten Bandung Barat, Jawa Barat 40559</p>
                  </div>
                  <Link href="/login" className="text-xs font-bold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                    Buka login
                  </Link>
                </div>
                <p className="mt-4 border-t border-white/15 pt-4 text-sm leading-6 text-white/80">
                  Lembaga pendidikan berbasis Tahfidz Al-Qur&apos;an sejak 2012. Motto: &quot;Membentuk Generasi Qur&apos;ani, Berintegritas,
                  Berilmu dan Berakhlak Mulia&quot;.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tentang" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Tentang pesantren</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-4xl">
              Pondok Pesantren Integritas Qur&apos;ani 368.
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-3">Jl. Ciwaruga, Parongpong, Kabupaten Bandung Barat, Jawa Barat 40559</p>
          </div>
          <div className="max-w-2xl">
            <p className="text-lg leading-8 text-ink-2">
              PPIQ-368 adalah lembaga pendidikan berbasis Tahfidz Al-Qur&apos;an yang berdiri sejak 2012. Visi kami adalah
              mewujudkan Generasi Qur&apos;ani berakhlak al-karimah, berjiwa mandiri, tangguh jiwa raga, dan cerdas paripurna.
            </p>
            <p className="mt-5 leading-7 text-ink-3">
              {APP_NAME} menyatukan proses administrasi, kegiatan akademik, dan komunikasi perkembangan santri dalam satu portal.
              Akses dibatasi berdasarkan tanggung jawab: wali hanya melihat anaknya sendiri, ustadz mengelola mapel yang diampu,
              Administrasi menangani PPDB, akun, dan administrasi santri, sedangkan Mudir mengelola data akademik dan
              mengawasi kehadiran ustadz.
            </p>
          </div>
        </div>
      </section>

      <section id="fitur" className="scroll-mt-20 border-y border-line bg-surface px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Enam fitur inti</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Dari pendaftaran sampai rapor.</h2>
            <p className="mt-4 leading-7 text-ink-3">Kegiatan harian pesantren disusun dalam alur yang saling terhubung dan mudah ditelusuri.</p>
          </div>

          <div className="mt-12 grid border-t border-line md:grid-cols-2">
            {coreFeatures.map((feature, index) => {
              const Icon = Icons[feature.icon];
              return (
                <article
                  key={feature.number}
                  className={`grid grid-cols-[48px_1fr] gap-4 border-b border-line py-6 md:gap-5 ${
                    index % 2 === 0 ? "md:pr-8" : "md:border-l md:pl-8"
                  }`}
                >
                  <span className="mono pt-1 text-xs font-bold text-primary-700">{feature.number}</span>
                  <div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-700">
                      <Icon size={19} />
                    </span>
                    <h3 className="mt-4 text-lg font-bold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-ink-3">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="peran" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Akses sesuai tanggung jawab</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-4xl">
              Tiap peran melihat hal yang memang dibutuhkan.
            </h2>
            <p className="mt-5 leading-7 text-ink-3">
              Pemisahan kewenangan menjaga pekerjaan tetap fokus dan data santri lebih aman.
            </p>
          </div>

          <div className="divide-y divide-line border-y border-line">
            {roles.map((role) => (
              <article key={role.code} className="grid gap-3 py-6 sm:grid-cols-[170px_1fr] sm:gap-6">
                <div>
                  <p className="font-bold">{role.name}</p>
                  <span className="mono mt-1 inline-block text-[11px] font-bold tracking-wider text-primary-700">{role.code}</span>
                </div>
                <p className="text-sm leading-6 text-ink-3">{role.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="alur" className="scroll-mt-20 bg-primary-700 px-5 py-20 text-white sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">Cara kerja</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Satu alur dari rumah sampai pesantren.</h2>
          </div>
          <div className="mt-12 grid border-t border-white/20 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.number}
                className={`border-b border-white/20 py-7 md:border-b-0 md:py-8 ${index > 0 ? "md:border-l md:pl-8" : "md:pr-8"}`}
              >
                <span className="mono text-xs font-bold text-white/55">{step.number}</span>
                <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 rounded-[24px] bg-primary-soft px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700">Mulai sekarang</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-balance">Buat akun wali dan daftarkan anak.</h2>
            <p className="mt-3 leading-7 text-ink-3">Satu akun dapat digunakan untuk memantau beberapa anak pada jenjang yang berbeda.</p>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
          >
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-surface px-5 py-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <img src="/icons/logo-mark.png" alt="" className="h-9 w-9 rounded-xl" />
              <span className="font-extrabold tracking-tight">{APP_NAME}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-3">{APP_TAGLINE} untuk wali, ustadz, Administrasi, dan Mudir Ma&apos;had.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-ink-2">
            <a href="#fitur" className="hover:text-primary">Fitur</a>
            <a href="#peran" className="hover:text-primary">Peran</a>
            <Link href="/login" className="hover:text-primary">Login</Link>
            <Link href="/register" className="hover:text-primary">Daftar</Link>
          </div>
        </div>
        <div className="mx-auto mt-8 w-full max-w-6xl border-t border-line pt-5 text-xs text-ink-3">
          © {new Date().getFullYear()} {APP_NAME}. Sistem informasi pondok pesantren.
        </div>
      </footer>
    </main>
  );
}
