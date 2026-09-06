import Link from "next/link";
import { requirePermission, userCan } from "@/lib/auth";
import { BKKH_TIME_SLOTS, countFilledBkkhSlots, type BkkhActivityField } from "@/lib/bkkh";
import {
  dateKeyToDb,
  getBkkhDailyReports,
  getBkkhMonthlyCounts,
  getStaffAttendanceBoard,
  getStaffAttendanceRecap,
  toDateKey,
} from "@/lib/lms";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { Badge, Card, Field, Icons, buttonClasses, inputClasses } from "@/components/ui";
import { DataExportButtons } from "@/components/DataExportButtons";
import { saveBkkhReportAction, saveStaffAttendanceAction } from "../actions";

// Harus memuat seluruh AttendanceStatus yang bisa disimpan lewat
// saveStaffAttendanceAction, termasuk Sakit, supaya badge-nya tidak kosong.
const STATUS_META = [
  { key: "PRESENT", label: "Hadir", color: "var(--green)" },
  { key: "EXCUSED", label: "Izin", color: "var(--primary)" },
  { key: "SICK", label: "Sakit", color: "var(--teal)" },
  { key: "LATE", label: "Terlambat", color: "var(--amber)" },
  { key: "ABSENT", label: "Alpa", color: "var(--red)" },
] as const;

function roleLabel(roles: readonly string[]): string {
  return roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(" & ");
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

type BkkhReportView = Partial<Record<BkkhActivityField, string | null>>;

function shiftDateKey(dateKey: string, days: number): string {
  const d = dateKeyToDb(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function BkkhReportReadout({ report }: { report: BkkhReportView }) {
  return (
      <dl className="divide-y divide-line">
        {BKKH_TIME_SLOTS.map((slot) => (
          <div key={slot.field} className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
            <dt className="text-[12px] font-bold tabular-nums text-primary-700">{slot.label}</dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{report[slot.field] || "Belum diisi"}</dd>
          </div>
        ))}
      </dl>
  );
}

export default async function AbsenUstadzPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; error?: string; success?: string }>;
}) {
  const [{ tanggal, error, success }, user] = await Promise.all([searchParams, requirePermission("staff_attendance.view")]);

  const todayKey = toDateKey(new Date());
  const dateKey = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? tanggal : todayKey;
  const [board, recap, bkkhReports, bkkhMonthly] = await Promise.all([
    getStaffAttendanceBoard(dateKey),
    getStaffAttendanceRecap(dateKey),
    getBkkhDailyReports(dateKey),
    getBkkhMonthlyCounts(dateKey),
  ]);

  const canRecord = userCan(user, "staff_attendance.record");
  const isStaffSelf = userCan(user, "staff_attendance.self");
  // A pure oversight account can view staff attendance but neither record it for others
  // nor self-report BKKH — that's the capability that used to be keyed off role === MUDIR.
  const isOversightOnly = !canRecord && !isStaffSelf;
  const isToday = dateKey === todayKey;
  const myReport = bkkhReports.get(user.id);
  const marked = board.filter((row) => row.status !== null).length;
  const recapById = new Map(recap.map((row) => [row.id, row]));
  const exportRows = board.map((row, index) => {
    const monthly = recapById.get(row.id);
    return {
      no: index + 1,
      name: row.name,
      role: roleLabel(row.roles),
      dailyStatus: STATUS_META.find((status) => status.key === row.status)?.label ?? "Belum tercatat",
      bkkhToday: `${countFilledBkkhSlots(bkkhReports.get(row.id))}/${BKKH_TIME_SLOTS.length}`,
      present: monthly?.present ?? 0,
      excused: monthly?.excused ?? 0,
      sick: monthly?.sick ?? 0,
      late: monthly?.late ?? 0,
      absent: monthly?.absent ?? 0,
      bkkhMonth: bkkhMonthly.get(row.id) ?? 0,
    };
  });

  const errorMessage =
    error === "forbidden"
      ? "Anda hanya dapat mengubah data sendiri untuk hari ini."
      : error === "activity"
          ? "Isi setidaknya satu keterangan kegiatan sebelum menyimpan."
          : error
            ? "Data tidak valid. Periksa kembali isian Anda."
            : null;

  return (
    <div className="view-enter flex flex-col" style={{ gap: 18 }}>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">{isOversightOnly ? "Pengawasan Ustadz" : "Absensi Ustadz"}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {canRecord
              ? "Catat kehadiran dan pantau laporan kegiatan harian ustadz."
              : isOversightOnly
                ? "Pantau kehadiran dan laporan kegiatan harian ustadz."
                : "Tandai kehadiran dan isi laporan kegiatan Anda hari ini."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form action="/absen-ustadz" method="GET" className="flex items-end gap-2">
            <div>
              <label htmlFor="tanggal" className="mb-1 block text-xs font-semibold text-ink-3">Tanggal</label>
              <input id="tanggal" type="date" name="tanggal" defaultValue={dateKey} className={inputClasses} />
            </div>
            <button type="submit" className={buttonClasses("ghost", "md")}>Tampilkan</button>
          </form>
          <DataExportButtons
            title="Rekap Absensi Ustadz"
            fileName={`absensi-ustadz-${dateKey}`}
            meta={{ Tanggal: dateFmt.format(dateKeyToDb(dateKey)), Bulan: monthFmt.format(dateKeyToDb(dateKey)) }}
            columns={[
              { key: "no", label: "No" },
              { key: "name", label: "Nama Ustadz" },
              { key: "role", label: "Peran" },
              { key: "dailyStatus", label: "Status Hari Ini" },
              { key: "bkkhToday", label: "BKKH Hari Ini" },
              { key: "present", label: "Hadir Bulan Ini" },
              { key: "excused", label: "Izin" },
              { key: "sick", label: "Sakit" },
              { key: "late", label: "Terlambat" },
              { key: "absent", label: "Alpa" },
              { key: "bkkhMonth", label: "Hari BKKH" },
            ]}
            rows={exportRows}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-line bg-danger-soft px-4 py-3 text-sm font-semibold" style={{ color: "var(--red)" }}>
          {errorMessage}
        </div>
      ) : null}

      {success === "bkkh" ? (
        <div className="rounded-xl border border-line bg-success-soft px-4 py-3 text-sm font-semibold" style={{ color: "var(--green)" }}>
          Laporan BKKH berhasil disimpan.
        </div>
      ) : null}

      <Card pad={20}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">{dateFmt.format(dateKeyToDb(dateKey))}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{marked} dari {board.length} ustadz sudah dicatat</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/absen-ustadz?tanggal=${shiftDateKey(dateKey, -1)}`} className={buttonClasses("ghost", "sm")} aria-label="Hari sebelumnya">
              <Icons.chevR size={15} style={{ transform: "rotate(180deg)" }} />
            </Link>
            {!isToday ? <Link href="/absen-ustadz" className={buttonClasses("soft", "sm")}>Hari ini</Link> : null}
            <Link href={`/absen-ustadz?tanggal=${shiftDateKey(dateKey, 1)}`} className={buttonClasses("ghost", "sm")} aria-label="Hari berikutnya">
              <Icons.chevR size={15} />
            </Link>
          </div>
        </div>

        {board.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">Belum ada akun ustadz atau wali kelas terverifikasi.</p>
        ) : (
          <div className="divide-y divide-line">
            {board.map((row) => {
              const canEdit = canRecord || (isToday && row.id === user.id);
              const meta = STATUS_META.find((status) => status.key === row.status);
              const report = bkkhReports.get(row.id);
              const filledSlots = countFilledBkkhSlots(report);
              return (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold">{row.name}</span>
                      {row.id === user.id ? <Badge tone="primary">Anda</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-ink-3">
                      {roleLabel(row.roles)} · {report ? `BKKH ${filledSlots}/${BKKH_TIME_SLOTS.length}` : "BKKH belum diisi"}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_META.map((status) => {
                        const active = row.status === status.key;
                        return (
                          <form key={status.key} action={saveStaffAttendanceAction}>
                            <input type="hidden" name="teacherId" value={row.id} />
                            <input type="hidden" name="date" value={dateKey} />
                            <input type="hidden" name="status" value={status.key} />
                            <button
                              type="submit"
                              className="rounded-full border px-3 py-2 text-[12.5px] font-semibold transition"
                              style={
                                active
                                  ? { background: status.color, borderColor: status.color, color: "#fff" }
                                  : { borderColor: "var(--border)", color: "var(--text-2)" }
                              }
                            >
                              {status.label}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold"
                      style={
                        meta
                          ? { background: meta.color, borderColor: meta.color, color: "#fff" }
                          : { borderColor: "var(--border)", color: "var(--text-3)" }
                      }
                    >
                      {meta ? meta.label : "Belum tercatat"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {isStaffSelf ? (
        <Card pad={20}>
          <div>
            <h2 className="text-base font-bold tracking-tight">Laporan Kegiatan Harian (BKKH)</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {isToday
                ? "Tuliskan kegiatan yang Anda lakukan pada setiap rentang waktu."
                : "Laporan pada tanggal ini hanya dapat dilihat. Pengisian dilakukan pada hari yang sama."}
            </p>
          </div>

          {isToday ? (
            <form action={saveBkkhReportAction} className="mt-5">
              <input type="hidden" name="teacherId" value={user.id} />
              <input type="hidden" name="date" value={dateKey} />

              <div className="mb-5 grid gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Nama lengkap</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{user.name}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Tanggal laporan</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{dateFmt.format(dateKeyToDb(dateKey))}</div>
                </div>
              </div>

              <div className="grid gap-x-4 md:grid-cols-2">
                {BKKH_TIME_SLOTS.map((slot) => (
                  <Field key={slot.field} label={slot.label}>
                    <textarea
                      name={slot.field}
                      maxLength={2000}
                      defaultValue={myReport?.[slot.field] ?? ""}
                      placeholder="Tuliskan kegiatan pada rentang waktu ini"
                      className={`${inputClasses} min-h-28 resize-y leading-relaxed`}
                    />
                  </Field>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-[12.5px] text-ink-3">Minimal satu rentang waktu harus diisi.</p>
                <button type="submit" className={buttonClasses("primary", "md")}>
                  {myReport ? "Perbarui laporan" : "Simpan laporan"}
                </button>
              </div>
            </form>
          ) : myReport ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <BkkhReportReadout report={myReport} />
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-surface-2 px-4 py-5 text-center text-sm text-ink-3">Belum ada laporan BKKH pada tanggal ini.</p>
          )}
        </Card>
      ) : null}

      {canRecord || isOversightOnly ? (
        <Card pad={0} className="overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-base font-bold tracking-tight">Laporan BKKH Harian</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Buka nama ustadz untuk melihat rincian kegiatannya.</p>
          </div>
          <div className="divide-y divide-line border-t border-line">
            {board.map((row) => {
              const report = bkkhReports.get(row.id);
              const filledSlots = countFilledBkkhSlots(report);
              return (
                <details key={row.id} className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{row.name}</div>
                      <div className="mt-0.5 text-[12px] text-ink-3">{roleLabel(row.roles)}</div>
                    </div>
                    <Badge tone={report ? "success" : "neutral"}>{report ? `${filledSlots}/6 terisi` : "Belum diisi"}</Badge>
                  </summary>
                  <div className="border-t border-line">
                    {report ? <BkkhReportReadout report={report} /> : <p className="px-5 py-5 text-sm text-ink-3">Belum ada laporan untuk tanggal ini.</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card pad={0} className="overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-base font-bold tracking-tight">Rekap {monthFmt.format(dateKeyToDb(dateKey))}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Jumlah hari kehadiran dan laporan BKKH dalam sebulan.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 520 }}>
            <thead>
              <tr className="bg-surface-2">
                <th className="sticky left-0 z-[2] min-w-[180px] bg-surface-2 px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-2">Nama</th>
                {STATUS_META.map((status) => (
                  <th key={status.key} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide" style={{ color: status.color }}>
                    {status.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2">Hari BKKH</th>
              </tr>
            </thead>
            <tbody>
              {recap.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="sticky left-0 z-[1] bg-surface px-5 py-3">
                    <div className="whitespace-nowrap text-sm font-semibold">{row.name}</div>
                    <div className="text-[11.5px] text-ink-3">{roleLabel(row.roles)}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums" style={{ color: "var(--green)" }}>{row.present}</td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums" style={{ color: "var(--primary)" }}>{row.excused}</td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums" style={{ color: "var(--teal)" }}>{row.sick}</td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums" style={{ color: "var(--amber)" }}>{row.late}</td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums" style={{ color: "var(--red)" }}>{row.absent}</td>
                  <td className="px-4 py-3 text-center text-sm font-extrabold tabular-nums text-ink-2">{bkkhMonthly.get(row.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
