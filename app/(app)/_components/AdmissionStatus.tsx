import Link from "next/link";
import type { getAdmissionsBySubmitter } from "@/lib/admissions";
import { Badge, Card, Icons, buttonClasses, type Tone } from "@/components/ui";

/**
 * Tampilan status pendaftaran untuk wali santri. Dipakai di dua tempat: ringkasan
 * pada dasbor wali dan daftar lengkap pada halaman Anak Saya, sehingga label
 * status dan susunan datanya tidak pernah berbeda antar halaman.
 */

type Status = "PENDING" | "ACCEPTED" | "REJECTED";
type Level = "SD" | "SMP" | "SMA";

export type AdmissionStatusItem = {
  id: string;
  registrationCode: string;
  childName: string;
  level: Level;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  note: string | null;
  reviewNote: string | null;
  studentNumber: string | null;
  childId: string | null;
  documents: {
    kind: string;
    label: string;
    required: boolean;
    source: "upload" | "link" | null;
    href: string | null;
    filename: string | null;
    typeLabel: string | null;
    sizeLabel: string | null;
    linkLabel: string | null;
  }[];
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Menunggu Ditinjau",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
};

const STATUS_TONE: Record<Status, Tone> = { PENDING: "warning", ACCEPTED: "success", REJECTED: "danger" };

const STATUS_MESSAGE: Record<Status, string> = {
  PENDING: "Pendaftaran sudah kami terima dan sedang menunggu ditinjau administrasi pesantren.",
  ACCEPTED: "Alhamdulillah, pendaftaran diterima. Data santri sudah tercatat pada menu Anak Saya.",
  REJECTED: "Mohon maaf, pendaftaran belum dapat diterima. Silakan hubungi administrasi bila ingin bertanya.",
};

const LEVEL_TONE: Record<Level, Tone> = { SD: "accent", SMP: "primary", SMA: "success" };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

type LoadedAdmission = Awaited<ReturnType<typeof getAdmissionsBySubmitter>>[number];

// Tanggal diformat sekali di sini supaya dasbor dan halaman Anak Saya memakai
// gaya penulisan tanggal yang sama.
export function toAdmissionStatusItems(admissions: LoadedAdmission[]): AdmissionStatusItem[] {
  return admissions.map((a) => ({
    id: a.id,
    registrationCode: a.registrationCode,
    childName: a.childName,
    level: a.level,
    status: a.status,
    createdAt: dateFmt.format(a.createdAt),
    reviewedAt: a.reviewedAt ? dateFmt.format(a.reviewedAt) : null,
    note: a.note,
    reviewNote: a.reviewNote,
    studentNumber: a.studentNumber,
    childId: a.childId,
    documents: a.documents.map((doc) => ({
      kind: doc.kind,
      label: doc.label,
      required: doc.required,
      source: doc.source,
      href: doc.href,
      filename: doc.filename,
      typeLabel: doc.typeLabel,
      sizeLabel: doc.sizeLabel,
      linkLabel: doc.linkLabel,
    })),
  }));
}

/* --------------------------------- kosong ---------------------------------- */

export function AdmissionStatusEmpty({ compact = false }: { compact?: boolean }) {
  const text = (
    <>
      <p className="text-sm text-ink-3 text-pretty">Belum ada pendaftaran santri yang Anda kirim.</p>
      <Link href="/pendaftaran" className={buttonClasses("soft", "sm", "mt-3")}>
        Daftarkan Anak
        <Icons.chevR size={15} />
      </Link>
    </>
  );

  if (compact) {
    return <div className="rounded-xl border border-dashed border-line p-5 text-center">{text}</div>;
  }

  return (
    <Card pad={32}>
      <div className="text-center">{text}</div>
    </Card>
  );
}

/* -------------------------------- ringkasan -------------------------------- */

export function AdmissionStatusRow({ item }: { item: AdmissionStatusItem }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-line p-3.5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary-700">
        {item.level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-bold">{item.childName}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-3">{item.registrationCode} · {item.createdAt}</div>
      </div>
      <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
    </div>
  );
}

/* ------------------------------- kartu penuh -------------------------------- */

function DocumentRow({ doc }: { doc: AdmissionStatusItem["documents"][number] }) {
  if (!doc.href || !doc.source) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
          <Icons.x size={15} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink-2">{doc.label}</div>
          <div className={`mt-0.5 text-[11.5px] font-semibold ${doc.required ? "text-danger" : "text-ink-3"}`}>
            {doc.required ? "Belum dikirim (wajib)" : "Belum dikirim (opsional)"}
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
      // Tautan luar tidak boleh mendapat akses window.opener maupun membocorkan
      // referrer halaman ini.
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-surface-2"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isLink ? "bg-accent-soft text-[oklch(0.42_0.1_200)]" : "bg-primary-soft text-primary-700"}`}
      >
        {isLink ? <Icons.chevR size={15} /> : <Icons.doc size={15} />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-ink-2">{doc.label}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-3">{meta}</div>
      </div>
    </a>
  );
}

export function AdmissionStatusCard({ item }: { item: AdmissionStatusItem }) {
  const rejected = item.status === "REJECTED";

  return (
    <Card pad={0} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3.5 p-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary-700">
          {item.level}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{item.childName}</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={LEVEL_TONE[item.level]}>{item.level}</Badge>
            <span className="text-[12.5px] text-ink-3">{item.registrationCode} · Dikirim {item.createdAt}</span>
          </div>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
      </div>

      <div className="border-t border-line p-4">
        <p className="text-[13.5px] leading-relaxed text-ink-2 text-pretty">{STATUS_MESSAGE[item.status]}</p>
        {item.reviewedAt ? <p className="mt-1.5 text-[12.5px] text-ink-3">Ditinjau pada {item.reviewedAt}</p> : null}

        {item.reviewNote ? (
          <div
            className={`mt-3 rounded-xl px-3.5 py-3 ${rejected ? "bg-danger-soft" : "bg-surface-2"}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {rejected ? "Alasan penolakan" : "Catatan penerimaan"}
            </div>
            <p className={`mt-1 text-[13.5px] leading-relaxed text-pretty ${rejected ? "font-semibold text-danger" : "text-ink-2"}`}>
              {item.reviewNote}
            </p>
          </div>
        ) : null}

        {item.studentNumber ? (
          <p className="mt-3 text-[13px] text-ink-2">
            NIS: <strong className="mono text-ink">{item.studentNumber}</strong>
          </p>
        ) : null}

        {item.childId ? (
          <Link href={`/anak/${item.childId}`} className={buttonClasses("soft", "sm", "mt-3")}>
            Lihat Data Santri
            <Icons.chevR size={15} />
          </Link>
        ) : null}

        <div className="mt-4 border-t border-line pt-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Berkas yang dikirim</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {item.documents.map((doc) => (
              <DocumentRow key={doc.kind} doc={doc} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
