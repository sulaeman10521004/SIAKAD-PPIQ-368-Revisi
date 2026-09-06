"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icons, inputClasses } from "@/components/ui";
import { deleteAttendanceSessionAction, updateAttendanceSessionAction } from "../actions";

type Session = { id: string; title: string; date: string; heldAt: string; recordCount: number };

/** Kelola sesi absensi (ubah judul/waktu, hapus) khusus pengampu yang ditugaskan. */
export function SessionManager({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(session: Session) {
    setError(null);
    setEditingId(session.id);
    setTitle(session.title);
    setHeldAt(session.heldAt);
  }

  function save(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateAttendanceSessionAction({ sessionId, title, heldAt });
      if (!res.ok) {
        setError(res.message ?? "Sesi absensi gagal diperbarui.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(session: Session) {
    const warning =
      session.recordCount > 0
        ? `Hapus sesi "${session.title}"? ${session.recordCount} catatan kehadiran santri pada sesi ini ikut terhapus permanen.`
        : `Hapus sesi "${session.title}"? Belum ada catatan kehadiran pada sesi ini.`;
    if (!confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAttendanceSessionAction(session.id);
      if (!res.ok) {
        setError(res.message ?? "Sesi absensi gagal dihapus.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  if (sessions.length === 0) return null;

  return (
    <Card pad={16} className="mb-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-bold">Kelola sesi absensi</div>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Ubah judul atau waktu sesi, atau hapus sesi beserta catatannya.</p>
        </div>
        <span className="text-[12.5px] font-semibold text-ink-3">{sessions.length} sesi</span>
      </div>

      {error ? (
        <div className="mb-2.5 rounded-xl border border-line bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</div>
      ) : null}

      <div className="divide-y divide-line">
        {sessions.map((s) => (
          <div key={s.id} className="py-2.5">
            {editingId === s.id ? (
              <div className="grid gap-2.5 md:grid-cols-[1fr_0.8fr_auto]">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Judul sesi"
                  placeholder="cth. Pertemuan 5"
                  className={inputClasses}
                />
                <input
                  value={heldAt}
                  onChange={(e) => setHeldAt(e.target.value)}
                  aria-label="Tanggal & waktu sesi"
                  type="datetime-local"
                  className={inputClasses}
                />
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" disabled={isPending} onClick={() => save(s.id)}>
                    Simpan
                  </Button>
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setEditingId(null)}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{s.title}</div>
                  <div className="text-[12px] text-ink-3">
                    {s.date} • {s.recordCount} catatan kehadiran
                  </div>
                </div>
                <button
                  onClick={() => startEdit(s)}
                  disabled={isPending}
                  title={`Ubah sesi ${s.title}`}
                  aria-label={`Ubah sesi ${s.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-primary-soft hover:text-primary-700 disabled:opacity-50"
                >
                  <Icons.edit size={15} />
                </button>
                <button
                  onClick={() => remove(s)}
                  disabled={isPending}
                  title={`Hapus sesi ${s.title}`}
                  aria-label={`Hapus sesi ${s.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                  <Icons.trash size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
