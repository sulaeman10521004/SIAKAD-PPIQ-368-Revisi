"use client";

import { useId, useState } from "react";
import { inputClasses } from "@/components/ui";

// Sengaja tidak mengimpor "@/lib/admissions": modul itu ikut menarik Prisma,
// yang tidak boleh masuk bundel klien.
type Mode = "upload" | "url";

const MODES: { value: Mode; label: string }[] = [
  { value: "upload", label: "Unggah berkas" },
  { value: "url", label: "Tautan (URL)" },
];

type Props = {
  label: string;
  required: boolean;
  fileField: string;
  urlField: string;
  accept: string;
  maxSizeLabel: string;
};

const fileInputClasses =
  "w-full cursor-pointer rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink-2 outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-primary-700 focus:border-primary";

/**
 * Satu dokumen boleh dilengkapi dengan salah satu cara saja. Input yang tidak
 * dipilih benar-benar dilepas dari DOM, bukan sekadar disembunyikan, supaya
 * formulir tidak pernah mengirim berkas dan tautan sekaligus.
 */
export function DocumentField({ label, required, fileField, urlField, accept, maxSizeLabel }: Props) {
  const [mode, setMode] = useState<Mode>("upload");
  const inputId = useId();

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
          {label}
          {required ? (
            <span className="text-danger"> *</span>
          ) : (
            <span className="ml-1 text-[11.5px] font-medium text-ink-3">(opsional)</span>
          )}
        </label>
        <div role="group" aria-label={`Cara melengkapi ${label}`} className="flex gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
          {MODES.map((m) => (
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

      <div className="mt-2">
        {mode === "upload" ? (
          <input id={inputId} name={fileField} type="file" accept={accept} required={required} className={fileInputClasses} />
        ) : (
          <input
            id={inputId}
            name={urlField}
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/..."
            required={required}
            className={inputClasses}
          />
        )}
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
        {mode === "upload"
          ? `Format JPG, PNG, atau PDF, maksimal ${maxSizeLabel}.`
          : "Tautan harus diawali http:// atau https:// dan dapat dibuka administrasi."}
      </p>
    </div>
  );
}
