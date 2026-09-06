import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseStatus } from "@/generated/prisma/client";
import { requirePermission, userCan } from "@/lib/auth";
import { getCourseManagement } from "@/lib/lms";
import { Avatar, Badge, Card, Field, Icons, inputClasses, buttonClasses, courseAccent, courseCode, initialsFromName } from "@/components/ui";
import { updateCourseAction } from "../../actions";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("course.view");
  const { id } = await params;

  const { course, teachingStaff, canManage } = await getCourseManagement(id, user);
  if (!course) notFound();
  const accent = courseAccent(course.id);
  const canGrade = userCan(user, "grade.manage");
  const canAttend = userCan(user, "attendance.record");

  return (
    <div className="view-enter">
      <Link href="/jadwal" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2">
        <Icons.chevL size={17} />
        Kembali ke Jadwal &amp; Mapel
      </Link>

      <div
        className="relative mb-5 overflow-hidden rounded-[22px] p-6 text-white lg:p-8"
        style={{ background: `color-mix(in oklch, ${accent.color}, #000 20%)` }}
      >
        <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative">
          <span className="mono rounded-md bg-black/20 px-2.5 py-1 text-[12.5px] font-semibold">{courseCode(course.title)}</span>
          <h1 className="my-3 text-2xl font-extrabold tracking-tight lg:text-3xl">{course.title}</h1>
          <p className="max-w-[560px] text-[14.5px] leading-relaxed opacity-90">{course.description}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
            <span><Badge tone="neutral">{course.level}</Badge></span>
            <span>Kelas: <strong>{course.classRoom?.name ?? "Belum ditentukan"}</strong></span>
            <span><strong>{course.enrollments.length}</strong> santri terdaftar</span>
            <span>Pengampu: <strong>{course.teacher?.name ?? "Belum ditugaskan"}</strong></span>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        {canGrade ? (
          <Link href={`/nilai?course=${course.id}`} className={buttonClasses("ghost", "sm")}>
            <Icons.chart size={15} /> Kelola Nilai
          </Link>
        ) : null}
        {canAttend ? (
          <Link href={`/absen?course=${course.id}`} className={buttonClasses("ghost", "sm")}>
            <Icons.check2 size={15} /> Kelola Absensi
          </Link>
        ) : null}
        <Link href="/jadwal" className={buttonClasses("ghost", "sm")}>
          <Icons.calendar size={15} /> {canManage ? "Kelola Jadwal" : "Lihat Jadwal"}
        </Link>
      </div>

      {canManage ? (
        <Card pad={20} className="mb-5">
          <h2 className="mb-4 text-base font-bold">Pengaturan Mata Pelajaran</h2>
          <form action={updateCourseAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_0.7fr_auto]">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Nama mata pelajaran">
              <input name="title" required defaultValue={course.title} className={inputClasses} />
            </Field>
            <Field label="Deskripsi singkat">
              <input name="description" required defaultValue={course.description} className={inputClasses} />
            </Field>
            <Field label="Ustadz pengampu">
              <select name="teacherId" required defaultValue={course.teacherId ?? ""} className={inputClasses}>
                <option value="" disabled>Pilih ustadz</option>
                {teachingStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={course.status} className={inputClasses}>
                <option value={CourseStatus.DRAFT}>Draft</option>
                <option value={CourseStatus.PUBLISHED}>Aktif</option>
                <option value={CourseStatus.ARCHIVED}>Arsip</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button type="submit" className={buttonClasses("primary", "md")}>Simpan</button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card pad={20} className="max-w-2xl">
        <h2 className="mb-4 text-base font-bold">Peserta ({course.enrollments.length})</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Peserta mengikuti penempatan kelas {course.classRoom?.name ?? "yang belum ditentukan"}. Perubahan peserta dikelola terpusat dari Data Akademik.
        </p>

        <div className="flex flex-col gap-2">
          {course.enrollments.length === 0 ? (
            <p className="text-sm text-ink-3">Belum ada peserta.</p>
          ) : (
            course.enrollments.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5">
                <Avatar initials={initialsFromName(e.student.name)} color={accent.color} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{e.student.name}</div>
                  <div className="mono text-[11px] text-ink-3">{e.student.studentNumber} · {e.student.className}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
