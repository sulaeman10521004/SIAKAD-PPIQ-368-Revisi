import Image from "next/image";
import { Badge } from "@/components/ui";
import { INSTITUTION_ADDRESS, INSTITUTION_NAME, INSTITUTION_PHONE } from "@/lib/brand";
import { formatPeriod } from "@/lib/lms";
import {
  getReportSignatories,
  groupEntries,
  isUngraded,
  REPORT_HEADER_NOTE,
  terbilang,
  type RaporSheet,
} from "@/lib/rapor";
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from "./status";
import styles from "./rapor.module.css";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "-";
}

function ScoreTable({
  caption,
  labelHeader = "Mata Pelajaran",
  rows,
}: {
  caption: string;
  labelHeader?: string;
  rows: { key: string; label: string; maxScore: number; scoreValue: number; scoreWords: string }[];
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-1">{caption}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-line text-sm" style={{ minWidth: 460 }}>
          <thead>
            <tr className="bg-surface-2">
              <th className="border border-line px-3 py-2 text-left text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                {labelHeader}
              </th>
              <th className="w-28 border border-line px-3 py-2 text-center text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                Nilai Maksimal
              </th>
              <th className="w-32 border border-line px-3 py-2 text-center text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                Nilai dengan Angka
              </th>
              <th className="w-40 border border-line px-3 py-2 text-center text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                Nilai dengan Huruf
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="border border-line px-3 py-2 font-semibold text-ink-1">{row.label}</td>
                <td className="border border-line px-3 py-2 text-center tabular-nums text-ink-2">{row.maxScore}</td>
                <td className="border border-line px-3 py-2 text-center text-[15px] font-extrabold tabular-nums text-ink-1">
                  {isUngraded(row) ? "–" : row.scoreValue}
                </td>
                <td className="border border-line px-3 py-2 text-center font-semibold text-ink-2">
                  {isUngraded(row) ? (
                    <span className="text-[12px] font-bold uppercase tracking-wide text-danger">Belum dinilai</span>
                  ) : (
                    row.scoreWords
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Lembar rapor sesuai formulir pondok. Dipakai halaman staf dan wali santri. */
export async function ReportCardSheet({ sheet, showStatus = true }: { sheet: RaporSheet; showStatus?: boolean }) {
  const groups = groupEntries(sheet.entries);
  // Penanda tangan diambil dari pengaturan aplikasi, bukan konstanta kode.
  const signatories = await getReportSignatories();

  return (
    <div className={`${styles.sheet} rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-7`}>
      {/* Kop rapor */}
      <div className={styles.letterhead}>
        <Image src="/icons/logo-mark.png" alt="Logo Pondok Pesantren Integritas Qur'ani 368" width={76} height={76} priority />
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-2">Pondok Pesantren</p>
          <h1 className="mt-0.5 text-xl font-extrabold uppercase tracking-tight text-ink-1">{INSTITUTION_NAME.replace(/^Pondok Pesantren\s*/i, "")}</h1>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{INSTITUTION_ADDRESS}</p>
          <p className="text-[11.5px] text-ink-2">Telp. {INSTITUTION_PHONE}</p>
        </div>
        <span aria-hidden="true" className={styles.letterheadSpacer} />
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-ink-1">Laporan Hasil Belajar Santri</h2>
          <p className="mt-1 text-sm font-semibold text-ink-2">{formatPeriod(sheet)}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{REPORT_HEADER_NOTE}</p>
        </div>
        {showStatus ? (
          <Badge tone={REPORT_STATUS_TONE[sheet.status]}>{REPORT_STATUS_LABEL[sheet.status]}</Badge>
        ) : null}
      </div>

      {/* Identitas santri */}
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-ink-3">Nama Santri</dt>
          <dd className="font-semibold text-ink-1">: {sheet.student.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-ink-3">Nomor Induk</dt>
          <dd className="mono font-semibold text-ink-1">: {sheet.student.studentNumber}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-ink-3">Kelas</dt>
          <dd className="font-semibold text-ink-1">: {sheet.student.className}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-ink-3">Jenjang</dt>
          <dd className="font-semibold text-ink-1">: {sheet.student.level}</dd>
        </div>
      </dl>

      {/* Nilai per kelompok penilaian */}
      {groups.length === 0 ? (
        <p className="mt-5 text-sm text-ink-3">Belum ada baris nilai pada rapor ini.</p>
      ) : (
        groups.map((group) => (
          <ScoreTable
            key={group.name}
            caption={group.name}
            rows={group.entries.map((entry) => ({
              key: entry.id,
              label: entry.courseTitle,
              maxScore: entry.maxScore,
              scoreValue: entry.scoreValue,
              scoreWords: entry.scoreWords,
            }))}
          />
        ))
      )}

      {/* Penilaian sikap */}
      {sheet.behaviorEntries.length > 0 ? (
        <ScoreTable
          caption="Penilaian Sikap dan Kedisiplinan"
          labelHeader="Aspek Penilaian"
          rows={sheet.behaviorEntries.map((entry) => ({
            key: entry.id,
            label: entry.criterionName,
            maxScore: entry.maxScore,
            scoreValue: entry.scoreValue,
            scoreWords: terbilang(entry.scoreValue),
          }))}
        />
      ) : null}

      {/* Rekap ketidakhadiran */}
      <section className="mt-5">
        <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-1">
          Rekapitulasi Ketidakhadiran
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-line text-sm" style={{ minWidth: 320 }}>
            <thead>
              <tr className="bg-surface-2">
                <th className="border border-line px-3 py-2 text-left text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                  Keterangan
                </th>
                <th className="w-32 border border-line px-3 py-2 text-center text-[11.5px] font-bold uppercase tracking-wide text-ink-2">
                  Jumlah Hari
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-line px-3 py-2 font-semibold text-ink-1">Sakit</td>
                <td className="border border-line px-3 py-2 text-center font-extrabold tabular-nums">{sheet.sickCount}</td>
              </tr>
              <tr>
                <td className="border border-line px-3 py-2 font-semibold text-ink-1">Izin</td>
                <td className="border border-line px-3 py-2 text-center font-extrabold tabular-nums">
                  {sheet.excusedCount}
                </td>
              </tr>
              <tr>
                <td className="border border-line px-3 py-2 font-semibold text-ink-1">Lain-lain</td>
                <td className="border border-line px-3 py-2 text-center font-extrabold tabular-nums">{sheet.otherCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Catatan wali kelas */}
      <section className="mt-5">
        <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-1">Catatan Wali Kelas</h3>
        <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm italic text-ink-2">
          {sheet.homeroomNote ? `"${sheet.homeroomNote}"` : "Belum ada catatan wali kelas."}
        </div>
      </section>

      {/* Tanda tangan */}
      <section className={`${styles.signature} mt-8 grid gap-8 sm:grid-cols-2`}>
        <div className="text-center text-sm">
          <p className="text-ink-2">{signatories.mudirTitle}</p>
          <div className="h-16" />
          <p className="font-bold text-ink-1 underline underline-offset-4">{signatories.mudirName}</p>
        </div>
        <div className="text-center text-sm">
          <p className="text-ink-2">{signatories.examChairTitle}</p>
          <div className="h-16" />
          <p className="font-bold text-ink-1 underline underline-offset-4">{signatories.examChairName}</p>
        </div>
      </section>

      {sheet.publishedAt ? (
        <p className="mt-6 text-center text-[12px] text-ink-3">
          Rapor diterbitkan pada {formatDate(sheet.publishedAt)}.
        </p>
      ) : null}
    </div>
  );
}
