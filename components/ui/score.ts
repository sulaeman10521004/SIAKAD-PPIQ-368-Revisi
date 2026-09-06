export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

/** KKM-style threshold: >=75 tuntas. */
export const PASS_THRESHOLD = 75;

export function scoreTone(n: number): Tone {
  if (n >= 85) return "success";
  if (n >= PASS_THRESHOLD) return "primary";
  if (n >= 70) return "warning";
  return "danger";
}

export function scoreColor(n: number): string {
  if (n >= 85) return "var(--green)";
  if (n >= PASS_THRESHOLD) return "var(--primary)";
  if (n >= 70) return "var(--amber)";
  return "var(--red)";
}

const ACCENTS = ["var(--primary)", "var(--teal)", "var(--green)", "var(--amber)", "var(--red)"] as const;
const ACCENT_SOFTS = ["var(--primary-soft)", "var(--teal-soft)", "var(--green-soft)", "var(--amber-soft)", "var(--red-soft)"] as const;

function hashIndex(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Deterministic accent color for a course, so cards stay colorful without storing presentation in the DB. */
export function courseAccent(id: string): { color: string; soft: string } {
  const i = hashIndex(id, ACCENTS.length);
  return { color: ACCENTS[i], soft: ACCENT_SOFTS[i] };
}

/** Short course code from its title, e.g. "Matematika Dasar" -> "MAT". */
export function courseCode(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  }
  return title.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "LMS";
}

export function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(bu|pak|dr|mr|ms|mrs)\.?$/i.test(w));
  const pick = words.length > 0 ? words : name.trim().split(/\s+/);
  return (
    pick
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || name.slice(0, 2).toUpperCase()
  );
}
