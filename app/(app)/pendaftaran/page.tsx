import Link from "next/link";
import { Card, Icons, inputClasses } from "@/components/ui";
import {
  ADMISSION_BIRTH_DATE_MESSAGE,
  ADMISSION_DOCUMENT_ACCEPT,
  ADMISSION_DOCUMENT_FIELD,
  ADMISSION_DOCUMENT_KINDS,
  ADMISSION_DOCUMENT_LABEL,
  ADMISSION_DOCUMENT_MAX_BYTES,
  ADMISSION_DOCUMENT_REQUIRED,
  ADMISSION_DOCUMENT_URL_FIELD,
  admissionDocumentIssueMessage,
  formatFileSize,
} from "@/lib/admissions";
import { requirePermission } from "@/lib/auth";
import { LEVEL_FULL, LEVELS } from "@/lib/brand";
import { submitAdmissionAction } from "./actions";
import { DocumentField } from "./DocumentField";

type PageProps = { searchParams: Promise<{ error?: string; doc?: string; success?: string; code?: string }> };

const ISSUE_REASONS = ["required", "size", "type", "mismatch", "empty", "both", "url"] as const;

// Galat per kolom formulir (bukan berkas), memakai gaya pesan yang sama.
const FIELD_ERROR_MESSAGE: Record<string, string> = ADMISSION_BIRTH_DATE_MESSAGE;

function Required() {
  return <span className="text-danger"> *</span>;
}

function Optional() {
  return <span className="ml-1 text-[11.5px] font-medium text-ink-3">(opsional)</span>;
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="sm:col-span-2">
      <div className="text-[12.5px] font-bold uppercase tracking-wider text-ink-3">{title}</div>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p> : null}
    </div>
  );
}

function errorMessageFrom(params: { error?: string; doc?: string }): string | null {
  if (!params.error) return null;

  const reason = ISSUE_REASONS.find((r) => r === params.error);
  const kind = ADMISSION_DOCUMENT_KINDS.find((k) => k === params.doc);

  if (reason && kind) {
    return admissionDocumentIssueMessage({ kind, reason });
  }

  const fieldMessage = FIELD_ERROR_MESSAGE[params.error];
  if (fieldMessage) {
    return fieldMessage;
  }

  return "Periksa kembali data wajib: nama lengkap santri dan jenjang harus terisi.";
}

export default async function PendaftaranPage({ searchParams }: PageProps) {
  const [params, user] = await Promise.all([searchParams, requirePermission("admission.submit")]);

  // requirePermission("admission.submit") already redirects anyone without the
  // permission to /dashboard, so this page is reachable only by wali santri.

  if (params.success) {
    return (
      <div className="view-enter">
        <Card pad={40} className="mx-auto max-w-lg text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-soft text-success">
            <Icons.check2 size={28} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-balance">Pendaftaran terkirim</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2 text-pretty">
            Data pendaftaran santri beserta berkasnya sudah kami terima. Administrasi akan meninjau pendaftaran; setelah
            diterima, anak akan muncul di menu Anak Saya.
          </p>
          {params.code ? (
            <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              Kode Daftar: <strong className="mono text-ink">{params.code}</strong>
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/anak" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-600">
              Lihat Anak Saya
            </Link>
            <Link href="/pendaftaran" className="rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-ink-2 transition hover:bg-surface-2">
              Daftarkan anak lain
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const errorMessage = errorMessageFrom(params);
  const maxSizeLabel = formatFileSize(ADMISSION_DOCUMENT_MAX_BYTES);

  return (
    <div className="view-enter mx-auto flex w-full max-w-3xl flex-col" style={{ gap: 20 }}>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Pendaftaran Santri Baru</h1>
        <p className="mt-1 text-sm text-ink-3">
          Diajukan oleh <strong className="text-ink">{user.name}</strong> ({user.email}). Data wali diambil dari akun login.
        </p>
        <p className="mt-1 text-sm text-ink-3">
          Kolom bertanda <span className="text-danger">*</span> wajib diisi.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">{errorMessage}</div>
      ) : null}

      <Card pad={24}>
        <form action={submitAdmissionAction} className="grid gap-5 sm:grid-cols-2">
          <SectionHeading title="Data Santri" hint="Isi sesuai dokumen resmi (kartu keluarga / akta kelahiran)." />
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Nama lengkap santri
              <Required />
            </span>
            <input name="childName" required className={inputClasses} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Jenjang
              <Required />
            </span>
            <select name="level" required defaultValue="" className={inputClasses}>
              <option value="" disabled>
                Pilih jenjang
              </option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_FULL[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Jenis kelamin
              <Optional />
            </span>
            <select name="gender" defaultValue="" className={inputClasses}>
              <option value="">-</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Tempat lahir
              <Optional />
            </span>
            <input name="birthPlace" className={inputClasses} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Tanggal lahir
              <Optional />
            </span>
            <input name="birthDate" type="date" className={inputClasses} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Asal sekolah
              <Optional />
            </span>
            <input name="previousSchool" placeholder="Contoh: MI Al-Hikmah" className={inputClasses} />
          </label>

          <div className="sm:col-span-2 border-t border-line" />
          <SectionHeading title="Alamat & Catatan" hint="Alamat tempat tinggal santri dan hal lain yang perlu diketahui administrasi." />
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Alamat
              <Optional />
            </span>
            <textarea name="address" rows={2} className={inputClasses} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-2">
              Catatan
              <Optional />
            </span>
            <textarea name="note" rows={2} placeholder="Riwayat kesehatan, kebutuhan khusus, dll." className={inputClasses} />
          </label>

          <div className="sm:col-span-2 border-t border-line" />
          <SectionHeading
            title="Dokumen Pendukung"
            hint={`Untuk setiap dokumen, pilih salah satu: unggah berkas hasil pindai/foto (JPG, PNG, atau PDF, maksimal ${maxSizeLabel}) atau isi tautan ke berkas tersebut. Cukup satu cara per dokumen.`}
          />
          {ADMISSION_DOCUMENT_KINDS.map((kind) => (
            <DocumentField
              key={kind}
              label={ADMISSION_DOCUMENT_LABEL[kind]}
              required={ADMISSION_DOCUMENT_REQUIRED[kind]}
              fileField={ADMISSION_DOCUMENT_FIELD[kind]}
              urlField={ADMISSION_DOCUMENT_URL_FIELD[kind]}
              accept={ADMISSION_DOCUMENT_ACCEPT}
              maxSizeLabel={maxSizeLabel}
            />
          ))}

          <button
            type="submit"
            className="mt-1 rounded-xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-600 active:scale-[0.99] sm:col-span-2"
          >
            Kirim Pendaftaran
          </button>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-3">
        Ingin memantau anak yang sudah terdaftar?{" "}
        <Link href="/anak" className="font-semibold text-primary-700 underline underline-offset-4">
          Cek Anak Saya
        </Link>
      </p>
    </div>
  );
}
