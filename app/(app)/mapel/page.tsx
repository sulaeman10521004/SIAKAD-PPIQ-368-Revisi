import { redirect } from "next/navigation";

// Mata Pelajaran is now a section inside /jadwal. This route stays around as a
// permanent redirect so stale links/bookmarks keep working.
export default function MapelPage() {
  redirect("/jadwal");
}
