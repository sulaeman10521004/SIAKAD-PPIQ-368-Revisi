"use client";

import { Button, Icons } from "@/components/ui";

/** Rapor dibagikan dalam bentuk cetak, jadi cukup panggil dialog cetak browser. */
export function PrintButton({ label = "Cetak Rapor" }: { label?: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => window.print()} icon={<Icons.download size={14} />}>
      {label}
    </Button>
  );
}
