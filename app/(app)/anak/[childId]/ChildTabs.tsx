"use client";

import { useState, ReactNode } from "react";

export function ChildTabs({
  detailTab,
  reportCardTab,
  reportCardsCount,
}: {
  detailTab: ReactNode;
  reportCardTab: ReactNode;
  reportCardsCount: number;
}) {
  const [activeTab, setActiveTab] = useState<"harian" | "rapor">("harian");

  return (
    <div className="flex flex-col gap-4.5">
      {/* Tabs Selector */}
      <div className="flex gap-2 border-b border-line pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("harian")}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition cursor-pointer outline-none ${
            activeTab === "harian"
              ? "border-primary text-primary"
              : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          Nilai & Kehadiran Harian
        </button>
        <button
          onClick={() => setActiveTab("rapor")}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition cursor-pointer outline-none flex items-center gap-1.5 ${
            activeTab === "rapor"
              ? "border-primary text-primary"
              : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          Rapor Semester
          {reportCardsCount > 0 && (
            <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition ${
              activeTab === "rapor" ? "bg-primary text-white" : "bg-surface-3 text-ink-2"
            }`}>
              {reportCardsCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="view-enter">
        {activeTab === "harian" ? detailTab : reportCardTab}
      </div>
    </div>
  );
}
