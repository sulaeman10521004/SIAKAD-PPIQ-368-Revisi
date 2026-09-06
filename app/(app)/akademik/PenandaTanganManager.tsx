"use client";

import { useState } from "react";
import { Button, Card, Field, Icons, inputClasses } from "@/components/ui";
import type { ReportSignatories } from "@/lib/rapor";
import { updateReportSignatoriesAction } from "./actions";
import { Toast, useActionRunner } from "../_components/crud-ui";

export function PenandaTanganManager({ initial }: { initial: ReportSignatories }) {
  const { run, toast, pending } = useActionRunner();
  const [form, setForm] = useState<ReportSignatories>(initial);

  const set = (field: keyof ReportSignatories) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const valid = (Object.values(form) as string[]).every((value) => value.trim().length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[19px] font-bold tracking-tight">Penanda Tangan Rapor</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Nama dan jabatan yang tercetak pada kolom tanda tangan lembar rapor. Perubahan langsung berlaku untuk seluruh
          rapor yang dicetak, termasuk yang sudah terbit.
        </p>
      </div>

      <Card pad={20}>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-2">Kolom Kiri</h3>
            <Field label="Jabatan">
              <input
                value={form.mudirTitle}
                onChange={(e) => set("mudirTitle")(e.target.value)}
                placeholder="cth. Mudir Ma'had"
                className={inputClasses}
              />
            </Field>
            <Field label="Nama penanda tangan">
              <input
                value={form.mudirName}
                onChange={(e) => set("mudirName")(e.target.value)}
                placeholder="cth. Ustadz Abdurrahman Fauzi, Lc."
                className={inputClasses}
              />
            </Field>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-2">Kolom Kanan</h3>
            <Field label="Jabatan">
              <input
                value={form.examChairTitle}
                onChange={(e) => set("examChairTitle")(e.target.value)}
                placeholder="cth. Ketua Panitia Ujian"
                className={inputClasses}
              />
            </Field>
            <Field label="Nama penanda tangan">
              <input
                value={form.examChairName}
                onChange={(e) => set("examChairName")(e.target.value)}
                placeholder="cth. Ustadz Taufiq Ramadhan, Lc."
                className={inputClasses}
              />
            </Field>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Button
            variant="primary"
            icon={<Icons.check2 size={17} />}
            disabled={!valid || pending}
            className={!valid || pending ? "opacity-50" : ""}
            onClick={() =>
              run(
                updateReportSignatoriesAction({
                  mudirTitle: form.mudirTitle.trim(),
                  mudirName: form.mudirName.trim(),
                  examChairTitle: form.examChairTitle.trim(),
                  examChairName: form.examChairName.trim(),
                }),
                "Penanda tangan rapor diperbarui",
              )
            }
          >
            Simpan Perubahan
          </Button>
        </div>
      </Card>

      <Toast toast={toast} />
    </div>
  );
}
