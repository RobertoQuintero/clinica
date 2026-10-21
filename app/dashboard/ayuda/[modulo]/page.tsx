import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/session";
import { MANUAL_MODULES, MANUAL_SECTION_LABELS, MANUAL_SECTION_ORDER } from "@/lib/manual/modules";
import { loadManualPages } from "@/lib/manual/content";
import { buildManualHref } from "@/lib/manual/links";
import { formatManualUpdatedDate } from "@/lib/manual/dateFormat";

interface Props {
  params: Promise<{ modulo: string }>;
}

export default async function ManualModuleIndexPage({ params }: Props) {
  const { modulo } = await params;
  const user = await requireActiveUser();

  const manualModule = MANUAL_MODULES.find((candidate) => candidate.slug === modulo);
  if (!manualModule) notFound();
  if (!manualModule.allowedRoleIds.includes(user.id_role)) redirect("/dashboard/ayuda");

  const pages = await loadManualPages(modulo);
  const sections = MANUAL_SECTION_ORDER.map((section) => ({
    section,
    label: MANUAL_SECTION_LABELS[section],
    pages: pages.filter((page) => page.section === section),
  })).filter((group) => group.pages.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/ayuda"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[#44474f] hover:text-[#0051d5] dark:text-zinc-400 dark:hover:text-blue-400"
        >
          <ArrowLeft size={14} />
          Ayuda
        </Link>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{manualModule.title}</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">{manualModule.description}</p>
      </div>

      <div className="flex flex-col gap-6">
        {sections.map((group) => (
          <section key={group.section}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#747780] dark:text-zinc-500">
              {group.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={buildManualHref(manualModule.slug, page.slug)}
                  className="group flex flex-col rounded-xl border border-[#c4c6d0] bg-white p-4 shadow-sm transition-colors hover:border-[#0051d5] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500"
                >
                  <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#0051d5] dark:text-zinc-50 dark:group-hover:text-blue-400">
                    {page.title}
                  </span>
                  <span className="mt-1 text-sm text-[#44474f] dark:text-zinc-400">{page.description}</span>
                  <span className="mt-2 text-xs text-[#747780] dark:text-zinc-500">
                    Actualizado: {formatManualUpdatedDate(page.updated)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
