"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Icons, inputClasses } from "@/components/ui";
import type { Semester } from "@/generated/prisma/client";
import { addGradeItemAction, deleteGradeItemAction } from "../actions";
import { updateGradeWeightsAction } from "./actions";
import { Toast, useActionRunner } from "../_components/crud-ui";

type Item = { id: string; title: string; maxScore: number; weight: number; dueAt: string; recordCount: number };
type CourseWeights = {
  id: string;
  title: string;
  className: string | null;
  items: Item[];
  weightSum: number;
  zeroWeightCount: number;
};
type Period = { semester: Semester; academicYear: string };
type Run = (p: Promise<{ ok: boolean; message?: string }>, okMsg: string, tone?: "ok" | "warn") => void;

function periodKey(p: Period) {
  return `${p.semester}|${p.academicYear}`;
}

function periodLabel(p: Period) {
  return `Semester ${p.semester === "GANJIL" ? "Ganjil" : "Genap"} ${p.academicYear}`;
}

/** Form tambah komponen nilai baru, langsung untuk periode yang sedang dipilih di tab Bobot. */
function AddItemForm({ courseId, period, run }: { courseId: string; period: Period; run: Run }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [weight, setWeight] = useState("0");
  const [dueAt, setDueAt] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-700 hover:underline"
      >
        <Icons.plus size={14} /> Tambah komponen
      </button>
    );
  }

  function submit() {
    run(
      addGradeItemAction({
        courseId,
        title: title.trim(),
        maxScore: Number(maxScore) || 0,
        weight: Number(weight) || 0,
        dueAt,
        semester: period.semester,
        academicYear: period.academicYear,
      }),
      `Komponen ${title.trim()} ditambahkan`,
    );
    setTitle("");
    setMaxScore("100");
    setWeight("0");
    setDueAt("");
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-[1.2fr_0.7fr_0.7fr_0.9fr_auto]">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth. UH 1" aria-label="Nama komponen" className={inputClasses} />
      <input
        value={maxScore}
        onChange={(e) => setMaxScore(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Nilai maks"
        aria-label="Nilai maksimal"
        className={inputClasses}
      />
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Bobot %"
        aria-label="Bobot persen"
        className={inputClasses}
      />
      <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="Tenggat" className={inputClasses} />
      <div className="flex gap-1.5">
        <Button variant="primary" size="sm" disabled={!title.trim()} onClick={submit}>
          Tambah
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

function CourseWeightCard({
  course,
  period,
  run,
}: {
  course: CourseWeights;
  period: Period;
  run: Run;
}) {
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(course.items.map((i) => [i.id, String(i.weight)])),
  );
  const sum = course.items.reduce((s, i) => s + (Number(weights[i.id]) || 0), 0);
  const balanced = sum === 100;
  const zeroWeights = course.items.filter((i) => (Number(weights[i.id]) || 0) === 0);

  function removeItem(item: Item) {
    const warning =
      item.recordCount > 0
        ? `Hapus komponen "${item.title}"? ${item.recordCount} nilai santri pada komponen ini ikut terhapus permanen.`
        : `Hapus komponen "${item.title}"? Belum ada nilai santri pada komponen ini.`;
    if (!confirm(warning)) return;
    run(deleteGradeItemAction(item.id), `Komponen ${item.title} dihapus`);
  }

  return (
    <Card pad={20}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight">{course.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{course.className ?? "Belum ada kelas"}</p>
        </div>
        <Badge tone={course.items.length === 0 ? "neutral" : balanced ? "success" : "danger"}>Total {sum}%</Badge>
      </div>

      {course.items.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">
          Belum ada komponen nilai pada {periodLabel(period)}.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {course.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-2">{i.title}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={weights[i.id] ?? ""}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [i.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                    className={`${inputClasses} max-w-[80px] text-right`}
                  />
                  <span className="text-sm text-ink-3">%</span>
                  <button
                    onClick={() => removeItem(i)}
                    title={`Hapus komponen ${i.title}`}
                    aria-label={`Hapus komponen ${i.title}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-danger-soft hover:text-danger"
                  >
                    <Icons.trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!balanced ? <p className="mt-2 text-[12.5px] font-semibold text-danger">Total bobot harus tepat 100%. Saat ini {sum}%.</p> : null}
          {zeroWeights.length > 0 ? (
            <p className="mt-2 text-[12.5px] font-semibold text-warning">
              {zeroWeights.length} komponen berbobot 0% dan tidak akan ikut dihitung di rapor.
            </p>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              disabled={!balanced}
              className={!balanced ? "opacity-50" : ""}
              onClick={() =>
                run(
                  updateGradeWeightsAction({
                    courseId: course.id,
                    semester: period.semester,
                    academicYear: period.academicYear,
                    weights: course.items.map((i) => ({ id: i.id, weight: Number(weights[i.id]) || 0 })),
                  }),
                  `Bobot ${course.title} disimpan`,
                )
              }
            >
              Simpan Bobot
            </Button>
          </div>
        </>
      )}

      <AddItemForm courseId={course.id} period={period} run={run} />
    </Card>
  );
}

export function BobotManager({
  courses,
  period,
  periods,
}: {
  courses: CourseWeights[];
  period: Period;
  periods: Period[];
}) {
  const router = useRouter();
  const { run, toast } = useActionRunner();
  const [q, setQ] = useState("");

  const list = useMemo(() => courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())), [courses, q]);
  const withItems = courses.filter((c) => c.items.length > 0);
  const unbalanced = withItems.filter((c) => c.weightSum !== 100);
  const withZeroWeight = withItems.filter((c) => c.zeroWeightCount > 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[19px] font-bold tracking-tight">Bobot Komponen Nilai</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Atur persentase bobot tiap komponen nilai per mata pelajaran. Total bobot wajib 100% untuk setiap periode.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 sm:max-w-[320px]">
          <Icons.search size={17} style={{ color: "var(--text-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari mata pelajaran"
            placeholder="Cari mata pelajaran…"
            className="w-full bg-transparent py-2.5 text-[13.5px] outline-none"
          />
        </div>
        <select
          value={periodKey(period)}
          aria-label="Periode bobot"
          onChange={(e) => {
            const [semester, academicYear] = e.target.value.split("|");
            router.push(`/akademik?tab=bobot&semester=${semester}&tahun=${encodeURIComponent(academicYear)}`);
          }}
          className={`${inputClasses} sm:max-w-[280px]`}
        >
          {periods.map((p) => (
            <option key={periodKey(p)} value={periodKey(p)}>
              {periodLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {unbalanced.length > 0 || withZeroWeight.length > 0 ? (
        <Card pad={16} className="border-warning/40">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
              <Icons.award size={14} />
            </span>
            <div className="text-[13px] text-ink-2">
              <div className="font-semibold">Bobot pada {periodLabel(period)} perlu diperiksa</div>
              <ul className="mt-1 list-disc pl-4 text-ink-3">
                {unbalanced.length > 0 ? (
                  <li>
                    {unbalanced.length} mapel totalnya belum 100%: {unbalanced.slice(0, 5).map((c) => `${c.title} (${c.weightSum}%)`).join(", ")}
                    {unbalanced.length > 5 ? ", …" : ""}.
                  </li>
                ) : null}
                {withZeroWeight.length > 0 ? (
                  <li>
                    {withZeroWeight.length} mapel punya komponen berbobot 0% sehingga komponen itu tidak ikut dihitung di rapor.
                  </li>
                ) : null}
                <li>Ustadz pengampu maupun mudir dapat menambah komponen baru (bobot awal 0%) atau mengubah bobot, jadi periksa ulang menjelang rapor.</li>
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Tidak ada mata pelajaran yang cocok.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => (
            <CourseWeightCard key={`${c.id}-${periodKey(period)}`} course={c} period={period} run={run} />
          ))}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
