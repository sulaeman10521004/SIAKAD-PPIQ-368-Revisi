"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, inputClasses } from "@/components/ui";
import { Modal } from "../_components/crud-ui";

// Sengaja tidak mengimpor "@/lib/admissions": modul itu ikut menarik Prisma,
// yang tidak boleh masuk bundel klien. Metadata berkas dikirim dari server.
export type DocumentSlot = {
  kind: string;
  label: string;
  required: boolean;
  fileField: string;
  urlField: string;
  // Ringkasan berkas yang sudah tersimpan; null bila jenis ini masih kosong.
  current: string | null;
};

export type AdmissionFormValues = {
  id: string | null;
  childName: string;
  level: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  previousSchool: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  note: string;
};

export const EMPTY_ADMISSION: AdmissionFormValues = {
  id: null,
  childName: "",
  level: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  previousSchool: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  address: "",
  note: "",
};

type Mode = "keep" | "upload" | "url" | "clear";

const fileInputClasses =
  "w-full cursor-pointer rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink-2 outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-primary-700 focus:border-primary";

function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-semibold text-ink-2">
      {children}
      {required ? <span className="text-danger"> *</span> : <span className="ml-1 text-[11.5px] font-medium text-ink-3">(opsional)</span>}
    </span>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="sm:col-span-2">
      <div className="text-[12.5px] font-bold uppercase tracking-wider text-ink-3">{title}</div>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p> : null}
    </div>
  );
}

/**
 * Satu jenis berkas hanya boleh terisi lewat satu jalur, jadi input yang tidak
 * dipilih benar-benar dilepas dari DOM (bukan disembunyikan). Mode "keep"
 * membiarkan berkas lama apa adanya dan "clear" mengosongkannya -- keduanya
 * tidak mengirim input apa pun selain penanda modenya.
 */
function DocumentSlotField({ slot, accept, maxSizeLabel }: { slot: DocumentSlot; accept: string; maxSizeLabel: string }) {
  const [mode, setMode] = useState<Mode>(slot.current ? "keep" : "upload");
  const inputId = useId();

  const modes: { value: Mode; label: string }[] = [
    ...(slot.current ? [{ value: "keep" as Mode, label: "Biarkan" }] : []),
    { value: "upload", label: "Unggah berkas" },
    { value: "url", label: "Tautan (URL)" },
    ...(slot.current ? [{ value: "clear" as Mode, label: "Kosongkan" }] : []),
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <input type="hidden" name={`doc_${slot.kind}_mode`} value={mode} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
          {slot.label}
          {slot.required ? <span className="text-danger"> *</span> : null}
        </label>
        <div role="group" aria-label={`Cara melengkapi ${slot.label}`} className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition ${
                mode === m.value ? "bg-primary text-white" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "upload" ? (
        <input id={inputId} name={slot.fileField} type="file" accept={accept} className={`${fileInputClasses} mt-2`} />
      ) : null}
      {mode === "url" ? (
        <input
          id={inputId}
          name={slot.urlField}
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/..."
          className={`${inputClasses} mt-2`}
        />
      ) : null}

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
        {mode === "keep"
          ? `Tersimpan: ${slot.current}.`
          : mode === "clear"
            ? `Berkas yang tersimpan (${slot.current}) akan dihapus.`
            : mode === "upload"
              ? `Format JPG, PNG, atau PDF, maksimal ${maxSizeLabel}.${slot.current ? " Berkas lama akan diganti." : ""}`
              : `Tautan harus diawali http:// atau https://.${slot.current ? " Berkas lama akan diganti." : ""}`}
      </p>
    </div>
  );
}

export function AdmissionForm({
  initial,
  levels,
  documents,
  accept,
  maxSizeLabel,
  pending,
  onClose,
  onSubmit,
}: {
  initial: AdmissionFormValues;
  levels: { value: string; label: string }[];
  documents: DocumentSlot[];
  accept: string;
  maxSizeLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const editing = initial.id !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <Modal
      title={editing ? "Edit Pendaftaran" : "Tambah Pendaftaran"}
      sub={
        editing
          ? "Perbaiki data pendaftaran yang masih menunggu tinjauan."
          : "Catat pendaftaran yang masuk di luar aplikasi (datang langsung ke pondok)."
      }
      width={720}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        {editing ? <input type="hidden" name="admissionId" value={initial.id ?? ""} /> : null}

        <SectionHeading title="Data Santri" hint="Isi sesuai dokumen resmi (kartu keluarga / akta kelahiran)." />
        <label className="block sm:col-span-2">
          <Label required>Nama lengkap santri</Label>
          <input name="childName" defaultValue={initial.childName} required autoFocus className={inputClasses} />
        </label>
        <label className="block">
          <Label required>Jenjang</Label>
          <select name="level" defaultValue={initial.level} required className={inputClasses}>
            <option value="" disabled>
              Pilih jenjang
            </option>
            {levels.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>Jenis kelamin</Label>
          <select name="gender" defaultValue={initial.gender} className={inputClasses}>
            <option value="">-</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </label>
        <label className="block">
          <Label>Tempat lahir</Label>
          <input name="birthPlace" defaultValue={initial.birthPlace} className={inputClasses} />
        </label>
        <label className="block">
          <Label>Tanggal lahir</Label>
          <input name="birthDate" type="date" defaultValue={initial.birthDate} className={inputClasses} />
        </label>
        <label className="block sm:col-span-2">
          <Label>Asal sekolah</Label>
          <input name="previousSchool" defaultValue={initial.previousSchool} placeholder="Contoh: MI Al-Hikmah" className={inputClasses} />
        </label>

        <div className="sm:col-span-2 border-t border-line" />
        <SectionHeading
          title="Data Wali"
          hint="Email wali dipakai saat pendaftaran diterima: akun wali dibuat baru atau ditautkan ke akun yang sudah ada."
        />
        <label className="block sm:col-span-2">
          <Label required>Nama wali</Label>
          <input name="parentName" defaultValue={initial.parentName} required className={inputClasses} />
        </label>
        <label className="block">
          <Label required>Email wali</Label>
          <input name="parentEmail" type="email" defaultValue={initial.parentEmail} required className={inputClasses} />
        </label>
        <label className="block">
          <Label required>Telepon wali</Label>
          <input name="parentPhone" defaultValue={initial.parentPhone} required placeholder="08xxxxxxxxxx" className={inputClasses} />
        </label>

        <div className="sm:col-span-2 border-t border-line" />
        <SectionHeading title="Alamat & Catatan" />
        <label className="block sm:col-span-2">
          <Label>Alamat</Label>
          <textarea name="address" defaultValue={initial.address} rows={2} className={inputClasses} />
        </label>
        <label className="block sm:col-span-2">
          <Label>Catatan</Label>
          <textarea name="note" defaultValue={initial.note} rows={2} placeholder="Riwayat kesehatan, kebutuhan khusus, dll." className={inputClasses} />
        </label>

        <div className="sm:col-span-2 border-t border-line" />
        <SectionHeading
          title="Dokumen Pendukung"
          hint={`Boleh menyusul. Untuk setiap dokumen pilih salah satu: unggah berkas (JPG, PNG, atau PDF, maksimal ${maxSizeLabel}) atau isi tautan.`}
        />
        {documents.map((slot) => (
          <DocumentSlotField key={slot.kind} slot={slot} accept={accept} maxSizeLabel={maxSizeLabel} />
        ))}

        <div className="mt-1 flex justify-end gap-2.5 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} className={pending ? "opacity-50" : ""}>
            {editing ? "Simpan Perubahan" : "Tambah Pendaftaran"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
