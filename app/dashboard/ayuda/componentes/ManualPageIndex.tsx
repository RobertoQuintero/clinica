import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { IManualPageSummary } from "@/interfaces/manual";
import { MANUAL_SECTION_LABELS, MANUAL_SECTION_ORDER } from "@/lib/manual/modules";
import { buildManualHref } from "@/lib/manual/links";

interface Props {
  moduleSlug: string;
  pages: readonly IManualPageSummary[];
  currentSlug: string;
}

/** Índice lateral agrupado por sección, marcando la página actual. En móvil se colapsa en un `<details>`. */
export default function ManualPageIndex({ moduleSlug, pages, currentSlug }: Props) {
  const sections = MANUAL_SECTION_ORDER.map((section) => ({
    section,
    label: MANUAL_SECTION_LABELS[section],
    pages: pages.filter((page) => page.section === section),
  })).filter((group) => group.pages.length > 0);

  const list = (
    <nav className="flex flex-col gap-5">
      {sections.map((group) => (
        <div key={group.section}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#747780] dark:text-zinc-500">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.pages.map((page) => {
              const isCurrent = page.slug === currentSlug;
              return (
                <li key={page.slug}>
                  <Link
                    href={buildManualHref(moduleSlug, page.slug)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      isCurrent
                        ? "bg-[#0051d5]/10 font-semibold text-[#0051d5] dark:bg-blue-500/15 dark:text-blue-400"
                        : "text-[#44474f] hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <details className="mb-4 rounded-xl border border-[#c4c6d0] bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">
          Índice del manual
          <ChevronDown className="h-4 w-4 text-[#747780] dark:text-zinc-500" />
        </summary>
        <div className="mt-3">{list}</div>
      </details>
      <aside className="hidden lg:block lg:w-60 lg:shrink-0">{list}</aside>
    </>
  );
}
