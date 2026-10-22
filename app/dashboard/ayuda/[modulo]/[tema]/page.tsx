import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { MANUAL_MODULES } from "@/lib/manual/modules";
import { loadManualPage, loadManualPages } from "@/lib/manual/content";
import { loadManualCapture, type IManualCapture } from "@/lib/manual/captures";
import { formatManualUpdatedDate } from "@/lib/manual/dateFormat";

const CAPTURE_MARKER_PATTERN = /\(captura:([a-z0-9-]+)\)/g;

/** Resuelve, de una sola vez, las capturas de los marcadores `captura:<name>` del cuerpo de la página. */
async function resolvePageCaptures(moduleSlug: string, body: string): Promise<Record<string, IManualCapture | null>> {
  const names = [...body.matchAll(CAPTURE_MARKER_PATTERN)].map((match) => match[1]);
  const entries = await Promise.all(
    names.map(async (name) => [name, await loadManualCapture(moduleSlug, name)] as const),
  );
  return Object.fromEntries(entries);
}
import ManualMarkdown from "../../componentes/ManualMarkdown";
import ManualPageIndex from "../../componentes/ManualPageIndex";
import ManualPagerLinks from "../../componentes/ManualPagerLinks";

interface Props {
  params: Promise<{ modulo: string; tema: string }>;
}

export default async function ManualPageDetailPage({ params }: Props) {
  const { modulo, tema } = await params;
  const user = await requireActiveUser();

  const manualModule = MANUAL_MODULES.find((candidate) => candidate.slug === modulo);
  if (!manualModule) notFound();
  if (!manualModule.allowedRoleIds.includes(user.id_role)) redirect("/dashboard/ayuda");

  const [page, pages] = await Promise.all([loadManualPage(modulo, tema), loadManualPages(modulo)]);
  if (!page) notFound();
  const captures = await resolvePageCaptures(modulo, page.body);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
        <Link href="/dashboard/ayuda" className="hover:text-[#0051d5] dark:hover:text-blue-400">
          Ayuda
        </Link>
        <span>/</span>
        <Link href={`/dashboard/ayuda/${modulo}`} className="hover:text-[#0051d5] dark:hover:text-blue-400">
          {manualModule.title}
        </Link>
      </div>

      <div className="lg:flex lg:items-start lg:gap-8">
        <ManualPageIndex moduleSlug={modulo} pages={pages} currentSlug={tema} />

        <div className="min-w-0 max-w-3xl flex-1">
          <h1 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{page.title}</h1>
          <p className="mt-1 text-xs text-[#747780] dark:text-zinc-500">
            Actualizado: {formatManualUpdatedDate(page.updated)}
          </p>

          <ManualMarkdown body={page.body} moduleSlug={modulo} captures={captures} />

          <ManualPagerLinks moduleSlug={modulo} previous={page.previous} next={page.next} />
        </div>
      </div>
    </div>
  );
}
