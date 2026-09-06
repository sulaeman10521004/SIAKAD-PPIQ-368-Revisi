import type { CSSProperties } from "react";

export type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

type BaseProps = IconProps & {
  d: string | string[];
  fill?: string;
  stroke?: string;
};

function Base({ d, size = 20, strokeWidth = 1.8, fill = "none", stroke = "currentColor", className, style }: BaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {Array.isArray(d) ? d.map((dd, i) => <path key={i} d={dd} />) : <path d={d} />}
    </svg>
  );
}

export const Icons = {
  grid: (p: IconProps) => <Base {...p} d={["M4 4h7v7H4z", "M13 4h7v7h-7z", "M13 13h7v7h-7z", "M4 13h7v7H4z"]} />,
  book: (p: IconProps) => (
    <Base {...p} d={["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 1 6.5 18H20"]} />
  ),
  chart: (p: IconProps) => <Base {...p} d={["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"]} />,
  check2: (p: IconProps) => <Base {...p} d={["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"]} />,
  users: (p: IconProps) => (
    <Base
      {...p}
      d={["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13A4 4 0 0 1 16 11"]}
    />
  ),
  calendar: (p: IconProps) => (
    <Base {...p} d={["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"]} />
  ),
  bell: (p: IconProps) => <Base {...p} d={["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"]} />,
  search: (p: IconProps) => <Base {...p} d={["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"]} />,
  settings: (p: IconProps) => (
    <Base
      {...p}
      d={[
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
      ]}
    />
  ),
  play: (p: IconProps) => <Base {...p} fill="currentColor" stroke="none" d="M8 5v14l11-7z" />,
  doc: (p: IconProps) => (
    <Base {...p} d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h6"]} />
  ),
  quiz: (p: IconProps) => (
    <Base {...p} d={["M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"]} />
  ),
  edit: (p: IconProps) => (
    <Base {...p} d={["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"]} />
  ),
  trash: (p: IconProps) => (
    <Base {...p} d={["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M10 11v6", "M14 11v6"]} />
  ),
  plus: (p: IconProps) => <Base {...p} d={["M12 5v14", "M5 12h14"]} />,
  chevR: (p: IconProps) => <Base {...p} d="M9 6l6 6-6 6" />,
  chevL: (p: IconProps) => <Base {...p} d="M15 6l-6 6 6 6" />,
  chevD: (p: IconProps) => <Base {...p} d="M6 9l6 6 6-6" />,
  arrowUp: (p: IconProps) => <Base {...p} d={["M12 19V5", "M5 12l7-7 7 7"]} />,
  arrowDown: (p: IconProps) => <Base {...p} d={["M12 5v14", "M19 12l-7 7-7-7"]} />,
  clock: (p: IconProps) => <Base {...p} d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]} />,
  logout: (p: IconProps) => <Base {...p} d={["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]} />,
  filter: (p: IconProps) => <Base {...p} d="M22 3H2l8 9.46V19l4 2v-8.54z" />,
  download: (p: IconProps) => <Base {...p} d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} />,
  award: (p: IconProps) => <Base {...p} d={["M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z", "M8.2 13.9L7 22l5-3 5 3-1.2-8.1"]} />,
  mail: (p: IconProps) => <Base {...p} d={["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M22 7l-10 6L2 7"]} />,
  menu: (p: IconProps) => <Base {...p} d={["M3 12h18", "M3 6h18", "M3 18h18"]} />,
  x: (p: IconProps) => <Base {...p} d={["M18 6L6 18", "M6 6l12 12"]} />,
  cap: (p: IconProps) => <Base {...p} d={["M22 10v6M2 10l10-5 10 5-10 5z", "M6 12v5c3 3 9 3 12 0v-5"]} />,
};

export type IconKey = keyof typeof Icons;
