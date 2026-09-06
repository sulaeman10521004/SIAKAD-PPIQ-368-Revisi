"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, Badge, Button, Card, Icons } from "@/components/ui";
import type { RaporBoardStudent } from "@/lib/rapor";
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from "./status";
import { generateRaporAction } from "./actions";
import { Semester } from "@/generated/prisma/client";

export function ReportBoardTable({
  students,
  semester,
  academicYear,
  canEdit,
}: {
  students: RaporBoardStudent[];
  semester: Semester;
  academicYear: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate(studentId: string) {
    startTransition(async () => {
      const res = await generateRaporAction({ studentId, semester, academicYear });
      if (!res.ok) {
        alert(res.message || "Gagal membuat rapor");
      } else {
        router.refresh();
      }
    });
  }

  if (students.length === 0) {
    return (
      <Card pad={40}>
        <p className="text-center text-sm text-ink-3">Tidak ada santri di kelas ini.</p>
      </Card>
    );
  }

  return (
    <Card pad={0} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 620 }}>
          <thead>
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-[2] min-w-[220px] bg-surface-2 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-2">
                Santri
              </th>
              <th className="w-36 whitespace-nowrap px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-2">
                Status Rapor
              </th>
              <th className="w-60 whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-ink-2">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => (
              <tr key={s.studentId} className="border-t border-line transition-colors hover:bg-surface-2/20">
                <td className="sticky left-0 z-[1] bg-surface px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs font-semibold text-ink-3">{idx + 1}</span>
                    <Avatar
                      initials={s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      color="var(--primary)"
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="whitespace-nowrap text-sm font-semibold text-ink-1">{s.name}</div>
                      <div className="mono text-[11.5px] text-ink-3">
                        {s.studentNumber} • {s.level}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {!s.reportCard ? (
                    <Badge tone="neutral">Belum Dibuat</Badge>
                  ) : (
                    <Badge tone={REPORT_STATUS_TONE[s.reportCard.status]}>
                      {REPORT_STATUS_LABEL[s.reportCard.status]}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {!s.reportCard ? (
                      canEdit ? (
                        <Button
                          disabled={isPending}
                          size="sm"
                          variant="primary"
                          onClick={() => handleCreate(s.studentId)}
                          icon={<Icons.plus size={14} />}
                        >
                          Buat Rapor
                        </Button>
                      ) : (
                        <span className="text-[12.5px] text-ink-3">Menunggu wali kelas</span>
                      )
                    ) : (
                      <Link href={`/rapor/${s.reportCard.id}`}>
                        <Button size="sm" variant="soft" icon={<Icons.doc size={14} />}>
                          Buka Rapor
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
