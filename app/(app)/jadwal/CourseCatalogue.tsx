"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EducationLevel } from "@/generated/prisma/client";
import { Avatar, Badge, Card, Icons, courseAccent, courseCode, initialsFromName, inputClasses } from "@/components/ui";
import { LEVEL_FULL } from "@/lib/brand";

type Course = {
  id: string;
  title: string;
  description: string;
  level: EducationLevel;
  classRoomId: string | null;
  className: string | null;
  teacher: string;
  students: number;
  scheduleSlots: number;
};

export function CourseCatalogue({ courses, initialLevel }: { courses: Course[]; initialLevel: EducationLevel }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"ALL" | EducationLevel>(initialLevel);
  const [classRoomId, setClassRoomId] = useState("ALL");

  const classes = useMemo(() => {
    const unique = new Map<string, string>();
    courses.forEach((course) => {
      if (course.classRoomId && course.className && (level === "ALL" || course.level === level)) {
        unique.set(course.classRoomId, course.className);
      }
    });
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [courses, level]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter(
      (course) =>
        (level === "ALL" || course.level === level) &&
        (classRoomId === "ALL" || course.classRoomId === classRoomId) &&
        (!needle || course.title.toLowerCase().includes(needle) || course.teacher.toLowerCase().includes(needle)),
    );
  }, [courses, query, level, classRoomId]);

  return (
    <div className="mt-2">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">Mata Pelajaran</h2>
          <p className="mt-1 text-sm text-ink-3">Menampilkan {list.length} dari {courses.length} mata pelajaran.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-2.5 sm:grid-cols-[minmax(220px,1fr)_180px_220px]">
        <label className="relative">
          <span className="sr-only">Cari mata pelajaran atau pengampu</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><Icons.search size={16} /></span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari mapel atau pengampu"
            className={`${inputClasses} pl-9`}
          />
        </label>
        <select
          value={level}
          aria-label="Filter jenjang"
          className={inputClasses}
          onChange={(event) => {
            setLevel(event.target.value as "ALL" | EducationLevel);
            setClassRoomId("ALL");
          }}
        >
          <option value="ALL">Semua jenjang</option>
          <option value="SD">SD</option>
          <option value="SMP">SMP</option>
          <option value="SMA">SMA</option>
        </select>
        <select value={classRoomId} aria-label="Filter kelas" className={inputClasses} onChange={(event) => setClassRoomId(event.target.value)}>
          <option value="ALL">Semua kelas {level === "ALL" ? "" : level}</option>
          {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <Card pad={40}><p className="text-center text-sm text-ink-3">Tidak ada mata pelajaran yang cocok.</p></Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {list.map((course) => {
            const accent = courseAccent(course.id);
            return (
              <Link key={course.id} href={`/mapel/${course.id}`} className="block">
                <Card hover pad={0} className="overflow-hidden">
                  <div className="relative flex h-20 items-end p-4" style={{ background: `color-mix(in oklch, ${accent.color}, #000 18%)` }}>
                    <div className="absolute -right-5 -top-5 h-28 w-28 rounded-full bg-white/10" />
                    <div className="relative flex w-full items-end justify-between">
                      <span className="mono rounded-md bg-black/20 px-2.5 py-1 text-xs font-semibold text-white">{courseCode(course.title)}</span>
                      <Badge tone="neutral">{course.className ?? LEVEL_FULL[course.level]}</Badge>
                    </div>
                  </div>
                  <div className="p-[18px]">
                    <h3 className="text-[17px] font-bold tracking-tight">{course.title}</h3>
                    <p className="mt-1.5 line-clamp-2 min-h-[38px] text-[13px] leading-relaxed text-ink-3">{course.description}</p>
                    <div className="my-3 flex items-center gap-2">
                      <Avatar initials={initialsFromName(course.teacher)} color={accent.color} size={28} />
                      <span className="truncate text-[13px] font-medium text-ink-2">{course.teacher}</span>
                    </div>
                    <div className="flex gap-4 text-[12.5px] text-ink-3">
                      <span className="flex items-center gap-1.5"><Icons.users size={15} />{course.students} santri</span>
                      <span className="flex items-center gap-1.5"><Icons.calendar size={15} />{course.scheduleSlots} slot</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
