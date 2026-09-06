"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Icons } from "@/components/ui";
import { deleteScheduleSlotAction } from "../actions";

export type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  room: string;
  courseId: string;
  courseTitle: string;
  teacher: string;
};

// Senin lebih dulu; dayOfWeek mengikuti Date.getDay() (0 = Ahad).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type Day = { dayOfWeek: number; label: string; slots: Slot[] };

/** Grid jadwal per hari, dipakai bersama oleh /jadwal (lihat saja) dan tab Jadwal di /akademik (kelola). */
export function DayGrid({ days, canEdit }: { days: Day[]; canEdit: boolean }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: 18 }}>
      {DISPLAY_ORDER.map((dayIdx) => {
        const day = days[dayIdx];
        return (
          <Card key={dayIdx} pad={16} className="flex flex-col">
            <div className="flex items-baseline justify-between border-b border-line pb-2.5">
              <span className="text-sm font-extrabold uppercase tracking-wider text-ink-1">{day.label}</span>
              <span className="text-xs font-semibold text-ink-3">{day.slots.length} sesi</span>
            </div>
            <ScheduleList slots={day.slots} canEdit={canEdit} />
          </Card>
        );
      })}
    </div>
  );
}

export function ScheduleList({ slots, canEdit }: { slots: Slot[]; canEdit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
      startTransition(async () => {
        const res = await deleteScheduleSlotAction(id);
        if (!res.ok) {
          alert(res.message || "Gagal menghapus jadwal");
        } else {
          router.refresh();
        }
      });
    }
  }

  if (slots.length === 0) {
    return <p className="py-3 text-[13px] text-ink-3">Tidak ada jadwal.</p>;
  }

  return (
    <div className="divide-y divide-line">
      {slots.map((slot) => (
        <div key={slot.id} className="flex items-center gap-3 py-2.5">
          <span className="mono w-[86px] shrink-0 text-[12px] font-bold text-primary">
            {slot.startTime}–{slot.endTime}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink-1">{slot.courseTitle}</div>
            <div className="truncate text-[12px] text-ink-3">
              {slot.teacher} • {slot.room}
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => handleDelete(slot.id)}
              disabled={isPending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger transition disabled:opacity-50"
              title="Hapus Jadwal"
            >
              <Icons.trash size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
