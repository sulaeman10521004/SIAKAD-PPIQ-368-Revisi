import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";

export function AuthShell({
  eyebrow,
  title,
  description,
  asideFooter,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  asideFooter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-surface text-ink lg:grid lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
      <aside className="bg-primary-700 text-white">
        <div className="mx-auto flex max-w-xl flex-col px-5 py-5 sm:px-8 lg:min-h-dvh lg:px-12 lg:py-10">
          <Link href="/" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <img src="/icons/logo-mark.png" alt="" className="h-9 w-9 rounded-xl" />
            <span className="text-base font-extrabold sm:text-lg">{APP_NAME}</span>
          </Link>

          <div className="hidden flex-1 flex-col justify-center lg:flex">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
            <h1 className="mt-5 max-w-lg text-4xl font-extrabold leading-[1.12] tracking-[-0.035em] text-balance xl:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/80 text-pretty">{description}</p>
          </div>

          {asideFooter ? <div className="hidden lg:block">{asideFooter}</div> : null}
        </div>
      </aside>

      <section className="flex px-5 py-8 sm:px-8 sm:py-12 lg:min-h-dvh lg:items-center lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
