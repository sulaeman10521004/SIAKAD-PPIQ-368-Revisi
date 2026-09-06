import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission, userCan } from "@/lib/auth";
import { formatPeriod } from "@/lib/lms";
import { Badge, Card, Icons } from "@/components/ui";
import { canReviewReports, getRaporSheet, getStudentAdministration } from "@/lib/rapor";
import { REPORT_STATUS_HINT, REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from "../status";
import { ReportCardSheet } from "../ReportCardSheet";
import { PrintButton } from "../PrintButton";
import { AdminPanel } from "./AdminPanel";
import { HomeroomPanel } from "./HomeroomPanel";
import styles from "../rapor.module.css";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function RaporDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAnyPermission(["report.manage", "report.approve", "report.distribute"]);

  const sheet = await getRaporSheet(id);
  if (!sheet) notFound();

  const isReviewer = canReviewReports(user);
  // Wali kelas hanya boleh melihat/menyunting rapor kelas binaannya sendiri, dan
  // hanya untuk tahun ajaran kelas binaan itu — sama seperti palang tulis di
  // actions.ts, supaya wali kelas sekarang tidak bisa membuka rapor tahun lalu
  // milik santri yang baru masuk kelasnya.
  const isOwnHomeroom =
    userCan(user, "report.manage") &&
    sheet.student.homeroomTeacherId === user.id &&
    sheet.student.classAcademicYear === sheet.academicYear;
  if (!isReviewer && !isOwnHomeroom) notFound();

  const period = { semester: sheet.semester, academicYear: sheet.academicYear };
  const administration = isReviewer ? await getStudentAdministration(sheet.student.id, period) : [];

  return (
    <div className="view-enter flex flex-col" style={{ gap: 20 }}>
      <div className={styles.noPrint}>
        <Link
          href={`/rapor?class=${sheet.student.classRoomId ?? ""}&semester=${sheet.semester}&year=${sheet.academicYear}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 transition hover:text-ink-2"
        >
          <Icons.chevL size={16} /> Kembali ke Rapor Kelas {sheet.student.className}
        </Link>
      </div>

      {/* Status alur kerja */}
      <Card pad={20} className={styles.noPrint}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-lg font-bold text-primary-700">
              {sheet.student.level}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink-1">{sheet.student.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                <Badge tone="primary">Kelas {sheet.student.className}</Badge>
                <span className="mono">{sheet.student.studentNumber}</span>
                <span className="text-ink-4">•</span>
                <span>{formatPeriod(period)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PrintButton />
            <div className="flex flex-col items-end gap-1">
              <Badge tone={REPORT_STATUS_TONE[sheet.status]}>{REPORT_STATUS_LABEL[sheet.status]}</Badge>
              <span className="text-[11px] font-semibold text-ink-3">{REPORT_STATUS_HINT[sheet.status]}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 border-t border-line pt-4 text-[12.5px] text-ink-3 sm:grid-cols-3">
          <div>
            <span className="font-bold text-ink-2">Disusun:</span>{" "}
            {sheet.createdByName ?? "-"}
          </div>
          <div>
            <span className="font-bold text-ink-2">Dikirim:</span>{" "}
            {sheet.submittedAt ? dateTimeFormatter.format(sheet.submittedAt) : "-"}
          </div>
          <div>
            <span className="font-bold text-ink-2">Ditinjau:</span>{" "}
            {sheet.reviewedAt
              ? `${sheet.reviewedByName ?? "Administrasi"} • ${dateTimeFormatter.format(sheet.reviewedAt)}`
              : "-"}
          </div>
        </div>

        {sheet.adminNote ? (
          <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[13px] text-ink-2">
            <span className="font-bold">Catatan administrasi:</span> {sheet.adminNote}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]" style={{ gap: 20 }}>
        <ReportCardSheet sheet={sheet} />

        <div className={`flex flex-col gap-4 ${styles.noPrint}`}>
          {isOwnHomeroom && (
            <Card pad={18}>
              <HomeroomPanel
                reportCardId={sheet.id}
                studentId={sheet.student.id}
                semester={sheet.semester}
                academicYear={sheet.academicYear}
                status={sheet.status}
                initialNote={sheet.homeroomNote ?? ""}
                behaviorEntries={sheet.behaviorEntries}
              />
            </Card>
          )}

          {isReviewer && (
            <Card pad={18}>
              <AdminPanel
                reportCardId={sheet.id}
                status={sheet.status}
                items={administration}
                initialNote={sheet.adminNote ?? ""}
                canApprove={userCan(user, "report.approve")}
                canDistribute={userCan(user, "report.distribute")}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
