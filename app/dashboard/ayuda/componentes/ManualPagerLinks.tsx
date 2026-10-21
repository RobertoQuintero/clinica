import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { IManualPageSummary } from "@/interfaces/manual";
import { buildManualHref } from "@/lib/manual/links";

interface Props {
  moduleSlug: string;
  previous: IManualPageSummary | null;
  next: IManualPageSummary | null;
}

/** Anterior / Siguiente. La primera página del manual no tiene "Anterior" y la última no tiene "Siguiente". */
export default function ManualPagerLinks({ moduleSlug, previous, next }: Props) {
  if (!previous && !next) return null;

  return (
    <nav className="mt-10 grid gap-3 border-t border-[#c4c6d0] pt-6 dark:border-zinc-700 sm:grid-cols-2">
      {previous && (
        <Link
          href={buildManualHref(moduleSlug, previous.slug)}
          className="group flex flex-col rounded-xl border border-[#c4c6d0] bg-white px-4 py-3 transition-colors hover:border-[#0051d5] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#747780] dark:text-zinc-500">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Anterior
          </span>
          <span className="mt-1 text-sm font-medium text-[#0b1c30] group-hover:text-[#0051d5] dark:text-zinc-100 dark:group-hover:text-blue-400">
            {previous.title}
          </span>
        </Link>
      )}
      {next && (
        <Link
          href={buildManualHref(moduleSlug, next.slug)}
          className="group flex flex-col rounded-xl border border-[#c4c6d0] bg-white px-4 py-3 text-right transition-colors hover:border-[#0051d5] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500 sm:items-end"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#747780] dark:text-zinc-500">
            Siguiente
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="mt-1 text-sm font-medium text-[#0b1c30] group-hover:text-[#0051d5] dark:text-zinc-100 dark:group-hover:text-blue-400">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
