"use client";

import { Button, Icons } from "@/components/ui";
import { downloadExcelReport, printTableReport, type ExportColumn, type ExportRow, type ExportValue } from "@/lib/export-client";

export function DataExportButtons({
  title,
  fileName,
  meta,
  columns,
  rows,
  orientation = "landscape",
}: {
  title: string;
  fileName: string;
  meta?: Record<string, ExportValue>;
  columns: ExportColumn[];
  rows: ExportRow[];
  orientation?: "portrait" | "landscape";
}) {
  const disabled = rows.length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        icon={<Icons.download size={14} />}
        onClick={() => downloadExcelReport({ title, fileName, meta, columns, rows })}
      >
        Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        icon={<Icons.doc size={14} />}
        onClick={() => printTableReport({ title, meta, columns, rows, orientation })}
      >
        Cetak / PDF
      </Button>
    </div>
  );
}
