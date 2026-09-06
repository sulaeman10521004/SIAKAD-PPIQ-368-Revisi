import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Pendaftaran mengunggah 4 berkas sekaligus (maks 2 MB per berkas) lewat
    // server action. Batas bawaan Next 1 MB menolak kiriman itu sebelum aksi
    // sempat berjalan; validasi ukuran per berkas tetap ditegakkan di server.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
