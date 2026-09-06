import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// Ikon PWA dibuat dari lambang resmi pondok di public/logo.png. Berkas sumber
// berlatar hitam, sedangkan lambangnya sendiri bundar dan hampir memenuhi tinggi
// gambar; jadi kita potong bagian tengah menjadi bujur sangkar lalu memakai topeng
// lingkaran supaya latar hitam di sudut hilang dan lambang bisa duduk di atas
// warna apa pun.
const SOURCE = new URL("../public/logo.png", import.meta.url).pathname;
const GREEN = "#2f9e57";

/** Lambang bundar berlatar transparan, ukuran sisi x sisi. */
async function roundedLogo(size) {
  const meta = await sharp(SOURCE).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.round((meta.width - side) / 2);
  const top = Math.round((meta.height - side) / 2);

  const logo = await sharp(SOURCE)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();

  // Radius sedikit di bawah setengah sisi supaya cincin putih lambang tidak ikut terpotong.
  const r = size / 2 - Math.max(1, Math.round(size * 0.005));
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#fff"/>
</svg>`,
  );

  return sharp(logo).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** Ikon biasa: lambang di atas putih, sudut membulat mengikuti gaya ikon aplikasi. */
async function icon(size) {
  const inner = Math.round(size * 0.9);
  const logo = await roundedLogo(inner);
  const radius = Math.round(size * 0.22);
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#ffffff"/>
</svg>`,
  );
  const off = Math.round((size - inner) / 2);
  return sharp(plate).composite([{ input: logo, top: off, left: off }]).png().toBuffer();
}

/** Ikon maskable: lambang lebih kecil di atas hijau, aman terhadap pemangkasan Android. */
async function maskableIcon(size) {
  const inner = Math.round(size * 0.62);
  const logo = await roundedLogo(inner);
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${GREEN}"/>
</svg>`,
  );
  const off = Math.round((size - inner) / 2);
  return sharp(plate).composite([{ input: logo, top: off, left: off }]).png().toBuffer();
}

await mkdir(new URL("../public/icons", import.meta.url), { recursive: true });

const targets = [
  { name: "icon-192.png", make: () => icon(192) },
  { name: "icon-512.png", make: () => icon(512) },
  { name: "icon-maskable-512.png", make: () => maskableIcon(512) },
  { name: "apple-touch-icon.png", make: () => icon(180) },
  { name: "logo-mark.png", make: () => roundedLogo(512) },
];

for (const t of targets) {
  const buf = await t.make();
  await sharp(buf).png().toFile(new URL(`../public/icons/${t.name}`, import.meta.url).pathname);
  console.log("wrote", t.name);
}
