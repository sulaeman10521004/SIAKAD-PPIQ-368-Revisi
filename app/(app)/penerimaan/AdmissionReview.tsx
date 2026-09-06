"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { Badge, Button, Card, Icons, inputClasses, type Tone } from "@/components/ui";
import { reviewAdmissionAction } from "../actions";
import { Modal, Toast, useActionRunner } from "../_components/crud-ui";
import { AdmissionForm, EMPTY_ADMISSION, type AdmissionFormValues, type DocumentSlot } from "./AdmissionForm";
import { createAdmissionAction, deleteAdmissionAction, updateAdmissionAction } from "./actions";

type Status = "PENDING" | "ACCEPTED" | "REJECTED";
type Level = "SD" | "SMP" | "SMA";

type AdmissionDocument = {
  kind: string;
  label: string;
  required: boolean;
  // "upload" = berkas tersimpan di sistem, "link" = tautan luar, null = kosong.
  source: "upload" | "link" | null;
  href: string | null;
  filename: string | null;
  typeLabel: string | null;
  sizeLabel: string | null;
  isImage: boolean;
  linkLabel: string | null;
};

type Admission = {
  id: string;
  registrationCode: string;
  childName: string;
  level: Level;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  previousSchool: string | null;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string | null;
  note: string | null;
  reviewNote: string | null;
  studentNumber: string | null;
  status: Status;
  createdAt: string;
  birthDateInput: string | null;
  submittedByParent: boolean;
  documents: AdmissionDocument[];
};

type DocumentField = { kind: string; label: string; required: boolean; fileField: string; urlField: string };

const STATUS_LABEL: Record<Status, string> = { PENDING: "Menunggu", ACCEPTED: "Diterima", REJECTED: "Ditolak" };
const STATUS_TONE: Record<Status, Tone> = { PENDING: "warning", ACCEPTED: "success", REJECTED: "danger" };
const STATUS_COLOR: Record<Status, string> = { PENDING: "var(--amber)", ACCEPTED: "var(--green)", REJECTED: "var(--red)" };
const LEVEL_TONE: Record<Level, Tone> = { SD: "accent", SMP: "primary", SMA: "success" };
const TABS: (Status | "ALL")[] = ["PENDING", "ACCEPTED", "REJECTED", "ALL"];
const TAB_LABEL: Record<Status | "ALL", string> = { PENDING: "Menunggu", ACCEPTED: "Diterima", REJECTED: "Ditolak", ALL: "Semua" };

function Detail({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-medium text-ink-2">{value}</div>
    </div>
  );
}

function DocumentCard({ doc }: { doc: AdmissionDocument }) {
  if (!doc.href || !doc.source) {
    return (
      <div className="flex min-h-[68px] items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
          <Icons.x size={16} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink-2">{doc.label}</div>
          <div className={`mt-0.5 text-[11.5px] font-semibold ${doc.required ? "text-danger" : "text-ink-3"}`}>
            {doc.required ? "Belum diunggah (wajib)" : "Belum diunggah (opsional)"}
          </div>
        </div>
      </div>
    );
  }

  const isLink = doc.source === "link";
  const meta = isLink
    ? `Tautan · ${doc.linkLabel ?? "tautan eksternal"}`
    : [doc.filename, doc.typeLabel, doc.sizeLabel].filter(Boolean).join(" · ");

  return (
    <a
      href={doc.href}
      target="_blank"
      // Berlaku untuk kedua jenis; tautan luar tidak boleh mendapat akses
      // window.opener maupun membocorkan referrer halaman tinjauan.
      rel="noopener noreferrer"
      className="flex min-h-[68px] items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-surface-2"
    >
      {doc.isImage && !isLink ? (
        <Image
          src={doc.href}
          alt={doc.label}
          width={44}
          height={44}
          unoptimized
          className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : (
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${isLink ? "bg-accent-soft text-[oklch(0.42_0.1_200)]" : "bg-primary-soft text-primary-700"}`}
        >
          {isLink ? <Icons.chevR size={16} /> : <Icons.doc size={16} />}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-ink-2">{doc.label}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-3">{meta}</div>
      </div>
    </a>
  );
}

/** Ringkasan berkas yang sudah tersimpan, untuk mode "Biarkan" di formulir. */
function currentDocumentLabel(doc: AdmissionDocument | undefined): string | null {
  if (!doc || !doc.source) return null;
  if (doc.source === "link") return `tautan ${doc.linkLabel ?? "eksternal"}`;
  return [doc.filename, doc.sizeLabel].filter(Boolean).join(" · ") || "berkas terunggah";
}

function toFormValues(admission: Admission): AdmissionFormValues {
  return {
    id: admission.id,
    childName: admission.childName,
    level: admission.level,
    gender: admission.gender ?? "",
    birthPlace: admission.birthPlace ?? "",
    birthDate: admission.birthDateInput ?? "",
    previousSchool: admission.previousSchool ?? "",
    parentName: admission.parentName,
    parentPhone: admission.parentPhone,
    parentEmail: admission.parentEmail,
    address: admission.address ?? "",
    note: admission.note ?? "",
  };
}

export function AdmissionReview({
  admissions,
  levels,
  documentFields,
  accept,
  maxSizeLabel,
}: {
  admissions: Admission[];
  levels: { value: string; label: string }[];
  documentFields: DocumentField[];
  accept: string;
  maxSizeLabel: string;
}) {
  const { run, toast, pending } = useActionRunner();
  const [tab, setTab] = useState<Status | "ALL">("PENDING");
  const [open, setOpen] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<{ values: AdmissionFormValues; documents: DocumentSlot[] } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [decisionFor, setDecisionFor] = useState<{ admission: Admission; decision: "ACCEPTED" | "REJECTED" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const counts = useMemo(
    () => ({
      ALL: admissions.length,
      PENDING: admissions.filter((a) => a.status === "PENDING").length,
      ACCEPTED: admissions.filter((a) => a.status === "ACCEPTED").length,
      REJECTED: admissions.filter((a) => a.status === "REJECTED").length,
    }),
    [admissions],
  );

  const list = admissions.filter((a) => tab === "ALL" || a.status === tab);

  const deleting = admissions.find((a) => a.id === deleteId) ?? null;

  function openDecision(admission: Admission, decision: "ACCEPTED" | "REJECTED") {
    setDecisionFor({ admission, decision });
    setReviewNote("");
  }

  function review() {
    if (!decisionFor) return;
    const { admission, decision } = decisionFor;
    run(
      reviewAdmissionAction({ admissionId: admission.id, decision, reviewNote }),
      decision === "ACCEPTED" ? `${admission.childName} diterima, akun wali ditautkan` : `${admission.childName} ditolak`,
      decision === "ACCEPTED" ? "ok" : "warn",
      () => {
        setOpen(null);
        setDecisionFor(null);
      },
    );
  }

  /** Slot berkas untuk formulir: gabungan daftar jenis berkas dengan isi yang sudah tersimpan. */
  function documentSlots(admission: Admission | null): DocumentSlot[] {
    return documentFields.map((field) => ({
      ...field,
      current: currentDocumentLabel(admission?.documents.find((doc) => doc.kind === field.kind)),
    }));
  }

  function openCreate() {
    setFormFor({ values: EMPTY_ADMISSION, documents: documentSlots(null) });
  }

  function openEdit(admission: Admission) {
    setFormFor({ values: toFormValues(admission), documents: documentSlots(admission) });
  }

  function submitForm(formData: FormData) {
    const editingId = formFor?.values.id ?? null;
    run(
      editingId ? updateAdmissionAction(formData) : createAdmissionAction(formData),
      editingId ? "Pendaftaran diperbarui" : "Pendaftaran ditambahkan",
      "ok",
      () => setFormFor(null),
    );
  }

  return (
    <div className="view-enter">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-balance">Pendaftaran Santri</h1>
          <p className="mt-1 text-sm text-ink-3 text-pretty">
            Catat dan tinjau pendaftaran santri baru. Menerima pendaftaran otomatis membuat atau menautkan akun wali dan
            data santri.
          </p>
        </div>
        <Button variant="primary" icon={<Icons.plus size={17} />} onClick={openCreate}>
          Tambah Pendaftaran
        </Button>
      </div>

      <Card pad={0} className="mb-4 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-line">
          {(["PENDING", "ACCEPTED", "REJECTED"] as Status[]).map((status) => (
            <div key={status} className="p-4 text-center sm:p-5">
              <div className="text-2xl font-extrabold tabular-nums leading-none tracking-tight" style={{ color: STATUS_COLOR[status] }}>
                {counts[status]}
              </div>
              <div className="mt-1.5 text-[12px] font-semibold text-ink-3 sm:text-[12.5px]">{STATUS_LABEL[status]}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-3.5 flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${tab === t ? "bg-primary text-white" : "text-ink-2"}`}
          >
            {TAB_LABEL[t]}
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t ? "bg-white/25" : "bg-surface-2"}`}>{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {list.length === 0 ? (
          <Card pad={40}>
            <p className="text-center text-sm text-ink-3">Tidak ada pendaftaran pada kategori ini.</p>
          </Card>
        ) : (
          list.map((a) => {
            const expanded = open === a.id;
            return (
              <Card key={a.id} pad={0} className="overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : a.id)} className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-surface-2">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary-700">{a.level}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{a.childName}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
                      {a.registrationCode} · Wali: {a.parentName}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <Badge tone={LEVEL_TONE[a.level]}>{a.level}</Badge>
                    <div className="mt-1 text-[11.5px] text-ink-3">{a.createdAt}</div>
                  </div>
                  <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  <Icons.chevD size={18} style={{ color: "var(--text-3)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>

                {expanded ? (
                  <div className="border-t border-line p-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Detail label="Kode Daftar" value={<span className="mono">{a.registrationCode}</span>} />
                      <Detail label="NIS" value={a.studentNumber ? <span className="mono">{a.studentNumber}</span> : null} />
                      <Detail label="Jenjang" value={a.level} />
                      <Detail label="Jenis Kelamin" value={a.gender === "L" ? "Laki-laki" : a.gender === "P" ? "Perempuan" : null} />
                      <Detail label="Tempat, Tgl Lahir" value={[a.birthPlace, a.birthDate].filter(Boolean).join(", ") || null} />
                      <Detail label="Asal Sekolah" value={a.previousSchool} />
                      <Detail label="Email Wali" value={a.parentEmail} />
                      <Detail label="Telepon" value={a.parentPhone} />
                      <Detail label="Alamat" value={a.address} />
                      <Detail label="Catatan" value={a.note} />
                      <Detail label="Catatan Keputusan" value={a.reviewNote} />
                      <Detail label="Sumber" value={a.submittedByParent ? "Dikirim wali santri" : "Dicatat administrasi"} />
                    </div>
                    <div className="mt-5 border-t border-line pt-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Dokumen Pendukung</span>
                        {a.documents.some((doc) => doc.required && !doc.href) ? (
                          <Badge tone="danger">Berkas wajib belum lengkap</Badge>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {a.documents.map((doc) => (
                          <DocumentCard key={doc.kind} doc={doc} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
                      {/* Data pendaftaran hanya boleh diubah selagi belum diputuskan:
                          setelah diterima, akun wali dan data santri sudah terlanjur dibuat darinya. */}
                      {a.status === "PENDING" ? (
                        <Button variant="ghost" disabled={pending} icon={<Icons.edit size={16} />} onClick={() => openEdit(a)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button variant="ghost" disabled={pending} icon={<Icons.trash size={16} />} onClick={() => setDeleteId(a.id)}>
                        Hapus
                      </Button>
                      {a.status === "PENDING" ? (
                        <>
                          <Button variant="danger" disabled={pending} onClick={() => openDecision(a, "REJECTED")}>
                            Tolak
                          </Button>
                          <Button variant="primary" disabled={pending} icon={<Icons.check2 size={16} />} onClick={() => openDecision(a, "ACCEPTED")}>
                            Terima Santri
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      {formFor ? (
        <AdmissionForm
          initial={formFor.values}
          documents={formFor.documents}
          levels={levels}
          accept={accept}
          maxSizeLabel={maxSizeLabel}
          pending={pending}
          onClose={() => setFormFor(null)}
          onSubmit={submitForm}
        />
      ) : null}

      {deleting ? (
        <Modal title="Hapus Pendaftaran" onClose={() => setDeleteId(null)}>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Hapus pendaftaran <strong>{deleting.childName}</strong> beserta berkas yang terunggah? Tindakan ini tidak
            bisa dibatalkan.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                const { id, childName } = deleting;
                run(deleteAdmissionAction(id), `Pendaftaran ${childName} dihapus`, "warn", () => setDeleteId(null));
              }}
            >
              Hapus
            </Button>
          </div>
        </Modal>
      ) : null}

      {decisionFor ? (
        <Modal
          title={decisionFor.decision === "ACCEPTED" ? "Terima Pendaftaran" : "Tolak Pendaftaran"}
          sub={`${decisionFor.admission.registrationCode} · ${decisionFor.admission.childName}`}
          onClose={() => setDecisionFor(null)}
        >
          <label htmlFor="review-note" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
            {decisionFor.decision === "ACCEPTED" ? "Catatan penerimaan (opsional)" : "Alasan penolakan (opsional)"}
          </label>
          <textarea
            id="review-note"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            maxLength={1000}
            rows={4}
            autoFocus
            placeholder={
              decisionFor.decision === "ACCEPTED"
                ? "Contoh: Berkas lengkap. Silakan mengikuti daftar ulang."
                : "Contoh: Dokumen wajib belum lengkap. Silakan lengkapi dan hubungi administrasi."
            }
            className={`${inputClasses} resize-y leading-relaxed`}
          />
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            Catatan dan hasil keputusan akan tampil di portal wali serta dikirim ke email jika layanan email aktif.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDecisionFor(null)}>Batal</Button>
            <Button
              variant={decisionFor.decision === "ACCEPTED" ? "primary" : "danger"}
              disabled={pending}
              onClick={review}
            >
              {decisionFor.decision === "ACCEPTED" ? "Terima dan Beri Notifikasi" : "Tolak dan Beri Notifikasi"}
            </Button>
          </div>
        </Modal>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
