import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icons, type IconProps } from "./icons";
import type { Tone } from "./score";

export { Icons } from "./icons";
export type { IconProps, IconKey } from "./icons";
export * from "./score";

/* ---------------------------------- Avatar --------------------------------- */
export function Avatar({
  initials,
  color = "var(--primary)",
  size = 38,
  title,
}: {
  initials: string;
  color?: string;
  size?: number;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36, letterSpacing: "-0.02em" }}
    >
      {initials}
    </div>
  );
}

/* ---------------------------------- Badge ---------------------------------- */
const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  primary: "bg-primary-soft text-primary-700",
  success: "bg-success-soft text-[oklch(0.42_0.13_150)]",
  warning: "bg-warning-soft text-[oklch(0.48_0.12_75)]",
  danger: "bg-danger-soft text-[oklch(0.46_0.16_25)]",
  accent: "bg-accent-soft text-[oklch(0.42_0.1_200)]",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-tight ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ----------------------------------- Card ---------------------------------- */
export function Card({
  children,
  className = "",
  pad = 20,
  hover = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  pad?: number;
  hover?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-soft ${
        hover ? "transition hover:border-line-strong hover:shadow-pop" : ""
      } ${className}`}
      style={{ padding: pad, ...style }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------- Button --------------------------------- */
type Variant = "primary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-soft hover:bg-primary-600",
  soft: "bg-primary-soft text-primary-700 hover:bg-primary-soft2",
  ghost: "border border-line text-ink-2 hover:bg-surface-2",
  danger: "border border-line text-danger hover:bg-danger-soft",
};
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-[15px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/* --------------------------------- Progress -------------------------------- */
export function Progress({ value, color = "var(--primary)", h = 8 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-surface-2" style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

/* ----------------------------------- Ring ---------------------------------- */
export function Ring({
  value,
  size = 84,
  stroke = 9,
  color = "var(--primary)",
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, Math.max(0, value))) / 100}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,.61,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-extrabold leading-none tracking-tight" style={{ fontSize: size * 0.26 }}>
            {label}
          </div>
          {sub ? <div className="mt-0.5 text-[10px] font-semibold text-ink-3">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- BarChart -------------------------------- */
export function BarChart({ data, height = 120 }: { data: { l: string; v: number; hot?: boolean }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-2.5 pt-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-[30px] rounded-t-md transition-[height] duration-500"
              style={{ height: `${(d.v / max) * 100}%`, minHeight: 4, background: d.hot ? "var(--primary)" : "var(--primary-soft-2)" }}
              title={String(d.v)}
            />
          </div>
          <div className="text-[11px] font-semibold text-ink-3">{d.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- SectionTitle ------------------------------ */
export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
        {sub ? <p className="mt-0.5 text-[13.5px] text-ink-3">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- StatCard -------------------------------- */
export function StatCard({
  label,
  value,
  delta,
  up = true,
  tone = "var(--primary)",
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  up?: boolean;
  tone?: string;
  icon: (p: IconProps) => ReactNode;
}) {
  return (
    <Card hover pad={18}>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2" style={{ color: tone }}>
          {icon({ size: 21 })}
        </div>
        {delta ? (
          <Badge tone={up ? "success" : "warning"}>
            {up ? <Icons.arrowUp size={12} /> : null}
            {delta}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3.5 text-[28px] font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[13px] font-medium text-ink-3">{label}</div>
    </Card>
  );
}

/* ----------------------------------- Field --------------------------------- */
export const inputClasses =
  "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-primary";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}
