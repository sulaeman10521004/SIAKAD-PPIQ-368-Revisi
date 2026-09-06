"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card, Field, Icons, inputClasses, initialsFromName, type Tone } from "@/components/ui";
import { ROLE_LABEL, ROLE_PRECEDENCE, sortRoles, type Role } from "@/lib/permissions";
import { navFor } from "../_components/nav";
import { createUserAction, deleteUserAction, setUserStatusAction, updateUserAction } from "../actions";

type Status = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
type User = { id: string; name: string; email: string; roles: Role[]; status: Status };

const ROLE_TONE: Record<Role, Tone> = { ADMIN: "accent", TEACHER: "primary", HOMEROOM: "neutral", MUDIR: "success", PARENT: "warning" };
const STATUS_LABEL: Record<Status, string> = { PENDING: "Menunggu", VERIFIED: "Aktif", REJECTED: "Ditolak", SUSPENDED: "Nonaktif" };
const STATUS_COLOR: Record<Status, string> = {
  PENDING: "var(--amber)",
  VERIFIED: "var(--green)",
  REJECTED: "var(--red)",
  SUSPENDED: "var(--text-3)",
};
const TABS: (Role | "ALL")[] = ["ALL", "PARENT", "HOMEROOM", "TEACHER", "MUDIR", "ADMIN"];
const TAB_LABEL: Record<Role | "ALL", string> = {
  ALL: "Semua",
  PARENT: "Wali Santri",
  HOMEROOM: "Wali Kelas",
  TEACHER: "Ustadz",
  MUDIR: "Mudir",
  ADMIN: "Administrasi",
};

/** Menu yang selalu tersedia untuk pengguna terverifikasi, di luar hak akses peran. */
const ALWAYS_AVAILABLE_HREFS = new Set(["/dashboard", "/pengaturan"]);

/* --------------------------------- Modal ---------------------------------- */
function Modal({ title, sub, onClose, children, width = 460 }: { title: string; sub?: string; onClose: () => void; children: ReactNode; width?: number }) {
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

/* ------------------------------- User form -------------------------------- */
function UserForm({ initial, onSave, onClose }: { initial: User | null; onSave: (data: FormSnapshot) => void; onClose: () => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roles, setRoles] = useState<Role[]>(initial?.roles ?? ["PARENT"]);
  const [status, setStatus] = useState<Status>(initial?.status ?? "VERIFIED");
  const valid = Boolean(name.trim() && email.trim() && roles.length > 0);

  const matchedMenus = useMemo(
    () => navFor(roles).filter((item) => !ALWAYS_AVAILABLE_HREFS.has(item.href)),
    [roles],
  );

  function toggleRole(role: Role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  return (
    <Modal
      title={isEdit ? "Edit Pengguna" : "Tambah Pengguna"}
      sub={isEdit ? "Perbarui data akun pengguna." : "Akun baru memakai kata sandi awal bawaan sistem. Sampaikan kepada pemiliknya lewat jalur pribadi dan minta segera diganti."}
      onClose={onClose}
    >
      <Field label="Nama lengkap">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth. Adinda Pratama" className={inputClasses} />
      </Field>
      <Field label="Email">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          disabled={isEdit}
          placeholder="nama@contoh.id"
          className={`${inputClasses} ${isEdit ? "bg-surface-2 text-ink-3" : ""}`}
        />
      </Field>
      <Field label="Peran (bisa lebih dari satu)">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {ROLE_PRECEDENCE.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={() => toggleRole(r)}
                className="h-4 w-4 rounded border-line-strong accent-primary"
              />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
        {roles.length === 0 ? <p className="mt-1.5 text-[12px] font-semibold text-danger">Pilih minimal satu peran.</p> : null}
      </Field>
      <div className="mb-4 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed">
        <p className="font-semibold text-ink">Peran terpilih memberi akses ke {matchedMenus.length} fitur</p>
        <p className="mt-0.5 text-ink-3">
          {matchedMenus.length ? matchedMenus.map((m) => m.label).join(" • ") : "Belum ada fitur yang dapat diakses."}
        </p>
      </div>
      {isEdit ? (
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputClasses}>
            <option value="VERIFIED">Aktif</option>
            <option value="PENDING">Menunggu</option>
            <option value="REJECTED">Ditolak</option>
            <option value="SUSPENDED">Nonaktif</option>
          </select>
        </Field>
      ) : null}
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => onSave({ name, email, roles, status })}
          className={!valid ? "opacity-50" : ""}
        >
          {isEdit ? "Simpan Perubahan" : "Tambah Pengguna"}
        </Button>
      </div>
    </Modal>
  );
}

type FormSnapshot = { name: string; email: string; roles: Role[]; status: Status };

/* ------------------------------ User manager ------------------------------ */
export function UserManager({ users, adminId, readOnly = false }: { users: User[]; adminId: string; readOnly?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Role | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ type: "add" | "edit" | "delete"; user?: User } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "warn" } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(
    () => ({
      ALL: users.length,
      PARENT: users.filter((u) => u.roles.includes("PARENT")).length,
      HOMEROOM: users.filter((u) => u.roles.includes("HOMEROOM")).length,
      TEACHER: users.filter((u) => u.roles.includes("TEACHER")).length,
      MUDIR: users.filter((u) => u.roles.includes("MUDIR")).length,
      ADMIN: users.filter((u) => u.roles.includes("ADMIN")).length,
    }),
    [users],
  );

  const list = users.filter(
    (u) =>
      (tab === "ALL" || u.roles.includes(tab)) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
  );

  function run(p: Promise<{ ok: boolean; message?: string }>, okMsg: string, tone: "ok" | "warn" = "ok") {
    startTransition(async () => {
      const res = await p;
      setToast(res.ok ? { msg: okMsg, tone } : { msg: res.message ?? "Gagal memproses.", tone: "warn" });
      if (res.ok) router.refresh();
    });
  }

  function save(data: FormSnapshot) {
    if (modal?.type === "edit" && modal.user) {
      run(
        updateUserAction({ userId: modal.user.id, name: data.name, roles: data.roles, status: data.status }),
        `Data ${data.name} diperbarui`,
      );
    } else {
      run(
        createUserAction({ name: data.name, email: data.email, roles: data.roles }),
        `${data.name} ditambahkan`,
      );
    }
    setModal(null);
  }

  const summary = [
    { label: "Total Pengguna", value: counts.ALL, icon: Icons.users, tone: "var(--primary)" },
    { label: "Wali Santri", value: counts.PARENT, icon: Icons.users, tone: "var(--amber)" },
    { label: "Wali Kelas", value: counts.HOMEROOM, icon: Icons.award, tone: "var(--teal)" },
    { label: "Ustadz", value: counts.TEACHER, icon: Icons.award, tone: "var(--green)" },
    { label: "Mudir", value: counts.MUDIR, icon: Icons.award, tone: "var(--primary)" },
  ];

  return (
    <div className="view-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Manajemen Pengguna</h1>
          <p className="mt-1 text-sm text-ink-3">
            {readOnly
              ? "Pantau akun wali santri, wali kelas, pengajar, mudir, dan administrasi."
              : "Verifikasi, tambah, dan kelola akun wali santri, wali kelas, pengajar, mudir, dan administrasi."}
          </p>
        </div>
        {!readOnly ? (
          <Button variant="primary" icon={<Icons.plus size={17} />} onClick={() => setModal({ type: "add" })}>
            Tambah Pengguna
          </Button>
        ) : null}
      </div>

      {/* summary */}
      <Card pad={0} className="mb-5 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-5">
          {summary.map((s, index) => (
            <div key={s.label} className={`bg-surface p-4 ${index === summary.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-surface-2" style={{ color: s.tone }}>
                  {s.icon({ size: 21 })}
                </div>
                <div>
                  <div className="text-2xl font-extrabold leading-none tracking-tight">{s.value}</div>
                  <div className="mt-1 text-[12.5px] text-ink-3">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* controls */}
      <div className="mb-3.5 flex flex-wrap justify-between gap-3">
        <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                tab === t ? "bg-primary text-white" : "text-ink-2"
              }`}
            >
              {TAB_LABEL[t]}
              <span className={`rounded-full px-1.5 text-[11px] ${tab === t ? "bg-white/25" : "bg-surface-2"}`}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 sm:max-w-[280px]">
          <Icons.search size={17} style={{ color: "var(--text-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari pengguna"
            placeholder="Cari nama atau email…"
            className="w-full bg-transparent py-2.5 text-[13.5px] outline-none"
          />
        </div>
      </div>

      {/* table */}
      <Card pad={0} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr className="bg-surface-2 text-xs font-bold uppercase tracking-wide text-ink-2">
                <th className="sticky left-0 z-[2] min-w-[200px] bg-surface-2 px-3.5 py-3 text-left">Nama</th>
                <th className="px-3.5 py-3 text-left">Peran</th>
                <th className="px-3.5 py-3 text-left">Status</th>
                <th className="px-3.5 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t border-line hover:bg-surface-2/20">
                  <td className="sticky left-0 z-[1] bg-surface px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={initialsFromName(u.name)} color="var(--primary)" size={36} />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap text-sm font-semibold">{u.name}</div>
                        <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
                          <Icons.mail size={12} />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sortRoles(u.roles).map((r) => (
                        <Badge key={r} tone={ROLE_TONE[r]}>
                          {ROLE_LABEL[r]}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: STATUS_COLOR[u.status] }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_COLOR[u.status] }} />
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {!readOnly && u.status === "PENDING" ? (
                        <button
                          title="Verifikasi"
                          aria-label={`Verifikasi ${u.name}`}
                          onClick={() => run(setUserStatusAction(u.id, "VERIFIED"), `${u.name} diverifikasi`)}
                          className="grid h-11 w-11 place-items-center rounded-lg text-success hover:bg-success-soft"
                        >
                          <Icons.check2 size={16} />
                        </button>
                      ) : null}
                      {!readOnly ? (
                        <>
                          <button
                            title="Edit"
                            aria-label={`Edit ${u.name}`}
                            onClick={() => setModal({ type: "edit", user: u })}
                            className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-primary-soft hover:text-primary-700"
                          >
                            <Icons.edit size={16} />
                          </button>
                          <button
                            title="Hapus"
                            aria-label={`Hapus ${u.name}`}
                            onClick={() => setModal({ type: "delete", user: u })}
                            className="grid h-11 w-11 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                          >
                            <Icons.trash size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? <div className="p-10 text-center text-sm text-ink-3">Tidak ada pengguna yang cocok.</div> : null}
      </Card>

      {modal?.type === "add" || modal?.type === "edit" ? (
        <UserForm initial={modal.type === "edit" ? modal.user ?? null : null} onSave={save} onClose={() => setModal(null)} />
      ) : null}

      {modal?.type === "delete" && modal.user ? (
        <Modal title="Hapus Pengguna?" onClose={() => setModal(null)} width={400}>
          <p className="text-sm leading-relaxed text-ink-2">
            Akun <strong className="text-ink">{modal.user.name}</strong> (
            {sortRoles(modal.user.roles)
              .map((r) => ROLE_LABEL[r])
              .join(", ")}
            ) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              style={{ background: "var(--red)" }}
              disabled={modal.user.id === adminId}
              onClick={() => {
                const u = modal.user!;
                run(deleteUserAction(u.id), `${u.name} dihapus`, "warn");
                setModal(null);
              }}
            >
              Ya, Hapus
            </Button>
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-white shadow-float">
          <span className="h-2 w-2 rounded-full" style={{ background: toast.tone === "ok" ? "var(--green)" : "var(--amber)" }} />
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}
