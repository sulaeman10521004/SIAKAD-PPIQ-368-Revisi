"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui";

/** Toast + router.refresh() glue shared by the CRUD managers (akademik, penerimaan). */
export function useActionRunner() {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "warn" } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * `onSuccess` dipakai form yang baru boleh ditutup setelah server menerima
   * datanya -- kalau ditutup lebih dulu, isian panjang (mis. formulir
   * pendaftaran) ikut hilang begitu validasi gagal.
   */
  function run(
    p: Promise<{ ok: boolean; message?: string }>,
    okMsg: string,
    tone: "ok" | "warn" = "ok",
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const res = await p;
      setToast(res.ok ? { msg: res.message ?? okMsg, tone } : { msg: res.message ?? "Gagal memproses.", tone: "warn" });
      if (res.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  return { run, toast, pending };
}

export function Toast({ toast }: { toast: { msg: string; tone: "ok" | "warn" } | null }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-white shadow-float">
      <span className="h-2 w-2 rounded-full" style={{ background: toast.tone === "ok" ? "var(--green)" : "var(--amber)" }} />
      {toast.msg}
    </div>
  );
}

export function Modal({
  title,
  sub,
  onClose,
  children,
  width = 460,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fade-enter fixed inset-0 z-[100] grid place-items-center bg-[oklch(0.27_0.02_165_/_0.45)] p-5 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="pop-enter flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-float"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3.5 border-b border-line px-6 py-5">
          <div>
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            {sub ? <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p> : null}
          </div>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-surface-2" aria-label="Tutup dialog">
            <Icons.x size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
