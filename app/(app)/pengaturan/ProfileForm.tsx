"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Field, Icons, inputClasses, initialsFromName } from "@/components/ui";
import { ROLE_LABEL, sortRoles, type Role } from "@/lib/permissions";
import { updateProfileAction } from "../actions";

export function ProfileForm({
  profile,
}: {
  profile: { name: string; email: string; roles: Role[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const unchanged = name.trim() === profile.name;
  const roleLabel = sortRoles(profile.roles).map((r) => ROLE_LABEL[r]).join(" & ");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  function save() {
    startTransition(async () => {
      const result = await updateProfileAction({ name });
      setToast({
        message: result.ok ? "Profil berhasil diperbarui" : result.message ?? "Profil gagal diperbarui",
        ok: result.ok,
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="view-enter max-w-[680px]">
      <h1 className="text-[26px] font-extrabold tracking-tight">Pengaturan</h1>
      <p className="mb-5 mt-1 text-sm text-ink-3">Perbarui identitas yang ditampilkan pada akun Anda.</p>

      <Card pad={24}>
        <div className="mb-6 flex items-center gap-4 border-b border-line pb-5">
          <Avatar initials={initialsFromName(profile.name)} color="var(--primary)" size={64} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{profile.name}</div>
            <div className="mt-0.5 text-[13.5px] text-ink-3">{roleLabel}</div>
          </div>
        </div>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Nama lengkap">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="name"
              className={inputClasses}
            />
          </Field>
          <Field label="Peran">
            <input value={roleLabel} disabled className={`${inputClasses} bg-surface-2 text-ink-3`} />
          </Field>
          <Field label="Email">
            <input value={profile.email} disabled className={`${inputClasses} bg-surface-2 text-ink-3`} />
          </Field>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12.5px] text-ink-3">Email dan peran dikelola oleh administrasi.</p>
          <Button variant="primary" onClick={save} disabled={pending || unchanged || !name.trim()}>
            {pending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </Card>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-white shadow-float"
        >
          {toast.ok ? <Icons.check2 size={16} style={{ color: "var(--green)" }} /> : <Icons.x size={16} style={{ color: "var(--red)" }} />}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
