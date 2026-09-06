export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SIAKAD PPIQ-368";
export const APP_SHORT = "PPIQ-368";
export const APP_TAGLINE = "Sistem Informasi Akademik Pondok Pesantren Integritas Qur'ani 368";
export const INSTITUTION_NAME = process.env.NEXT_PUBLIC_INSTITUTION_NAME || "Pondok Pesantren Integritas Qur'ani 368";
export const INSTITUTION_ADDRESS = process.env.NEXT_PUBLIC_INSTITUTION_ADDRESS || "Jl. Sersan Bajuri No. 45, Cihideung, Parongpong, Bandung Barat";
export const INSTITUTION_PHONE = process.env.NEXT_PUBLIC_INSTITUTION_PHONE || "-";

export const LEVEL_LABEL = { SD: "SD", SMP: "SMP", SMA: "SMA" } as const;
export const LEVEL_FULL = {
  SD: "Sekolah Dasar",
  SMP: "SMP",
  SMA: "SMA",
} as const;

export type Level = keyof typeof LEVEL_LABEL;
export const LEVELS: Level[] = ["SD", "SMP", "SMA"];
