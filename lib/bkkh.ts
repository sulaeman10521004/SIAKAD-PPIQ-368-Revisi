export const BKKH_TIME_SLOTS = [
  { field: "activity03000715", label: "03.00 - 07.15" },
  { field: "activity07150900", label: "07.15 - 09.00" },
  { field: "activity09301200", label: "09.30 - 12.00" },
  { field: "activity12301430", label: "12.30 - 14.30" },
  { field: "activity15301700", label: "15.30 - 17.00" },
  { field: "activity18002100", label: "18.00 - 21.00" },
] as const;

export type BkkhActivityField = (typeof BKKH_TIME_SLOTS)[number]["field"];

export type BkkhActivityValues = Record<BkkhActivityField, string | null>;

export function countFilledBkkhSlots(report: Partial<BkkhActivityValues> | null | undefined): number {
  if (!report) return 0;
  return BKKH_TIME_SLOTS.reduce((count, slot) => count + (report[slot.field]?.trim() ? 1 : 0), 0);
}
