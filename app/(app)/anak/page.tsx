import Link from "next/link";
import { getAdmissionsBySubmitter } from "@/lib/admissions";
import { requirePermission } from "@/lib/auth";
import { getParentChildren } from "@/lib/lms";
import { Badge, Card, Icons, Ring, SectionTitle, scoreColor, type Tone } from "@/components/ui";
import { AdmissionStatusCard, AdmissionStatusEmpty, toAdmissionStatusItems } from "../_components/AdmissionStatus";

type Level = "SD" | "SMP" | "SMA";
const LEVEL_TONE: Record<Level, Tone> = { SD: "accent", SMP: "primary", SMA: "success" };

export default async function AnakPage() {
  const user = await requirePermission("child.monitor");
  const [children, admissions] = await Promise.all([getParentChildren(user.id), getAdmissionsBySubmitter(user.id)]);
  const admissionItems = toAdmissionStatusItems(admissions);

  return (
    <div className="view-enter">
      <div className="mb-5">
        <h1 className="text-[26px] font-extrabold tracking-tight text-balance">Anak Saya</h1>
        <p className="mt-1 text-sm text-ink-3 text-pretty">Pilih santri untuk melihat rincian nilai dan kehadiran.</p>
      </div>

      {children.length === 0 ? (
        <Card pad={40}>
          <p className="text-center text-sm text-ink-3">Belum ada data santri yang terhubung dengan akun Anda.</p>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {children.map((c) => (
            <Link key={c.childId} href={`/anak/${c.childId}`}>
              <Card hover pad={20}>
                <div className="flex items-center gap-3.5">
                  <Ring value={c.attRate} size={64} stroke={7} color={scoreColor(c.attRate)} label={`${c.attRate}%`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-bold">{c.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={LEVEL_TONE[c.level as Level]}>{c.level}</Badge>
                      <span className="text-[12.5px] text-ink-3">{c.className}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3.5 text-center">
                  <div>
                    <div className="text-[17px] font-extrabold tabular-nums" style={{ color: scoreColor(c.avg) }}>{c.avg || "-"}</div>
                    <div className="text-[11px] text-ink-3">Nilai</div>
                  </div>
                  <div>
                    <div className="text-[17px] font-extrabold tabular-nums text-ink">{c.attRate}%</div>
                    <div className="text-[11px] text-ink-3">Hadir</div>
                  </div>
                  <div>
                    <div className="text-[17px] font-extrabold tabular-nums text-ink">{c.courses}</div>
                    <div className="text-[11px] text-ink-3">Mapel</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 text-[12.5px] font-semibold text-primary-700">
                  Lihat rincian <Icons.chevR size={15} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div id="status-pendaftaran" className="mt-8 scroll-mt-24">
        <SectionTitle
          title="Status Pendaftaran"
          sub="Hasil seleksi pendaftaran santri baru yang Anda kirim melalui sistem."
        />
        {admissionItems.length === 0 ? (
          <AdmissionStatusEmpty />
        ) : (
          <div className="flex flex-col gap-3">
            {admissionItems.map((item) => (
              <AdmissionStatusCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
