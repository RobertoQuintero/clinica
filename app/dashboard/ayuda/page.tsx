import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/session";
import { getVisibleManualModules } from "@/lib/manual/modules";
import { MANUAL_MODULE_ICONS } from "./componentes/manualModuleIcons";

export default async function ManualIndexPage() {
  const user = await requireActiveUser();
  const manualModules = getVisibleManualModules(user.id_role);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Ayuda</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Manuales de usuario, en lenguaje sencillo y con los textos exactos de cada pantalla.
        </p>
      </div>

      {manualModules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#c4c6d0] bg-white px-4 py-6 text-sm text-[#44474f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Todavía no hay un manual para tu rol.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {manualModules.map((manualModule) => {
            const Icon = MANUAL_MODULE_ICONS[manualModule.slug] ?? BookOpen;
            return (
              <Link
                key={manualModule.slug}
                href={`/dashboard/ayuda/${manualModule.slug}`}
                className="group flex items-start gap-4 rounded-xl border border-[#c4c6d0] bg-white p-5 shadow-sm transition-colors hover:border-[#0051d5] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eff4ff] text-[#0051d5] dark:bg-zinc-800 dark:text-blue-400">
                  <Icon size={20} />
                </span>
                <span className="flex-1">
                  <span className="flex items-center justify-between">
                    <span className="text-base font-semibold text-[#0b1c30] group-hover:text-[#0051d5] dark:text-zinc-50 dark:group-hover:text-blue-400">
                      {manualModule.title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#747780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0051d5] dark:text-zinc-500 dark:group-hover:text-blue-400" />
                  </span>
                  <span className="mt-1 block text-sm text-[#44474f] dark:text-zinc-400">
                    {manualModule.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
