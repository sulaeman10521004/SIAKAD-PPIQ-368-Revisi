import {
  ADMISSION_DOCUMENT_ACCEPT,
  ADMISSION_DOCUMENT_FIELD,
  ADMISSION_DOCUMENT_KINDS,
  ADMISSION_DOCUMENT_LABEL,
  ADMISSION_DOCUMENT_MAX_BYTES,
  ADMISSION_DOCUMENT_REQUIRED,
  ADMISSION_DOCUMENT_URL_FIELD,
  formatFileSize,
  getAdmissionsForReview,
  toAdmissionDocumentViews,
  toDateInputValue,
} from "@/lib/admissions";
import { requirePermission } from "@/lib/auth";
import { LEVEL_FULL, LEVELS } from "@/lib/brand";
import { AdmissionReview } from "./AdmissionReview";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

// Nama input per jenis berkas dikirim dari server karena AdmissionForm sengaja
// tidak mengimpor "@/lib/admissions" (modul itu ikut menarik Prisma).
const DOCUMENT_FIELDS = ADMISSION_DOCUMENT_KINDS.map((kind) => ({
  kind,
  label: ADMISSION_DOCUMENT_LABEL[kind],
  required: ADMISSION_DOCUMENT_REQUIRED[kind],
  fileField: ADMISSION_DOCUMENT_FIELD[kind],
  urlField: ADMISSION_DOCUMENT_URL_FIELD[kind],
}));

const LEVEL_OPTIONS = LEVELS.map((level) => ({ value: level, label: LEVEL_FULL[level] }));

export default async function PenerimaanPage() {
  await requirePermission("admission.review");
  const admissions = await getAdmissionsForReview();

  const rows = admissions.map((a) => ({
    id: a.id,
    registrationCode: a.registrationCode,
    childName: a.childName,
    level: a.level,
    gender: a.gender,
    birthPlace: a.birthPlace,
    birthDate: a.birthDate ? dateFmt.format(a.birthDate) : null,
    // Nilai mentah untuk <input type="date"> pada formulir ubah.
    birthDateInput: toDateInputValue(a.birthDate),
    previousSchool: a.previousSchool,
    parentName: a.parentName,
    parentPhone: a.parentPhone,
    parentEmail: a.parentEmail,
    address: a.address,
    note: a.note,
    reviewNote: a.reviewNote,
    studentNumber: a.studentNumber,
    status: a.status,
    createdAt: dateFmt.format(a.createdAt),
    // Pendaftaran tanpa submitter berarti dicatat administrasi (datang langsung).
    submittedByParent: a.submitterId !== null,
    documents: toAdmissionDocumentViews(a),
  }));

  return (
    <AdmissionReview
      admissions={rows}
      levels={LEVEL_OPTIONS}
      documentFields={DOCUMENT_FIELDS}
      accept={ADMISSION_DOCUMENT_ACCEPT}
      maxSizeLabel={formatFileSize(ADMISSION_DOCUMENT_MAX_BYTES)}
    />
  );
}
